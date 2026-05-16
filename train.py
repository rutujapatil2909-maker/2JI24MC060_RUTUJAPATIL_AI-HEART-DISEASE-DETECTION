"""
train.py — CNN + LSTM Coronary Stenosis Classifier
====================================================
Trains a ResNet18 + LSTM model to classify angiography video clips
as Normal or Blocked (stenosis detected).

Dataset structure expected:
  dataset/
    normal/
      video1/  (folder of frame images: frame_001.jpg, ...)
      video2/
    blocked/
      video3/
      video4/

Usage:
  python model/train.py

Output:
  model/cnn_lstm_angio.pth   — saved model weights
"""

import os
import cv2
import torch
import numpy as np
from torch import nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms, models

# ── Config ────────────────────────────────────────────────────────────────
DATASET_DIR  = "dataset"
MODEL_OUT    = "model/cnn_lstm_angio.pth"
SEQ_LEN      = 20       # frames per clip
BATCH_SIZE   = 2
EPOCHS       = 10
LR           = 1e-4
IMG_SIZE     = 224
DEVICE       = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(f"[Config] Device: {DEVICE}")
print(f"[Config] Dataset: {DATASET_DIR}")
print(f"[Config] Output:  {MODEL_OUT}")


# ══════════════════════════════════════════════════════════════════════════
#  DATASET
# ══════════════════════════════════════════════════════════════════════════

class AngioDataset(Dataset):
    """
    Loads pre-extracted frame folders.
    Each sample = (seq_len, C, H, W) tensor + binary label (0=normal, 1=blocked).
    """

    def __init__(self, root_dir: str, seq_len: int = SEQ_LEN):
        self.samples  = []
        self.seq_len  = seq_len
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((IMG_SIZE, IMG_SIZE)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406],
                                 std =[0.229, 0.224, 0.225]),
        ])

        for label, category in enumerate(["normal", "blocked"]):
            cat_path = os.path.join(root_dir, category)
            if not os.path.isdir(cat_path):
                print(f"[Warning] Missing folder: {cat_path}")
                continue
            for video_name in os.listdir(cat_path):
                video_path = os.path.join(cat_path, video_name)
                if not os.path.isdir(video_path):
                    continue
                frames = sorted([
                    f for f in os.listdir(video_path)
                    if f.lower().endswith(('.jpg', '.jpeg', '.png'))
                ])
                if len(frames) < 2:
                    continue
                self.samples.append((video_path, frames, label))

        print(f"[Dataset] {len(self.samples)} video clips loaded "
              f"({sum(1 for _,_,l in self.samples if l==0)} normal, "
              f"{sum(1 for _,_,l in self.samples if l==1)} blocked)")

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        video_path, frames, label = self.samples[idx]
        frames = frames[:self.seq_len]
        images = []

        for f in frames:
            img = cv2.imread(os.path.join(video_path, f))
            if img is None:
                continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img = self.transform(img)
            images.append(img)

        # Pad with last frame if clip is shorter than seq_len
        while len(images) < self.seq_len:
            images.append(images[-1] if images else torch.zeros(3, IMG_SIZE, IMG_SIZE))

        images = torch.stack(images)  # (seq_len, C, H, W)
        return images, torch.tensor(label, dtype=torch.float32)


# ══════════════════════════════════════════════════════════════════════════
#  MODEL: CNN (ResNet18) + LSTM
# ══════════════════════════════════════════════════════════════════════════

class CNN_LSTM(nn.Module):
    """
    Architecture:
      - ResNet18 (pretrained ImageNet) as per-frame feature extractor
        → removes final FC layer → outputs 512-dim feature per frame
      - LSTM (1 layer, hidden=256) learns temporal flow dynamics
      - FC + Sigmoid → binary classification (normal / blocked)
    """

    def __init__(self, hidden_size: int = 256, num_layers: int = 1):
        super().__init__()

        # Pretrained CNN backbone (freeze early layers)
        cnn = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        # Freeze first 6 layers (keep high-level features trainable)
        layers = list(cnn.children())
        for layer in layers[:6]:
            for param in layer.parameters():
                param.requires_grad = False
        self.cnn = nn.Sequential(*layers[:-1])  # remove final FC → (B, 512, 1, 1)

        self.lstm = nn.LSTM(
            input_size  = 512,
            hidden_size = hidden_size,
            num_layers  = num_layers,
            batch_first = True,
            dropout     = 0.3 if num_layers > 1 else 0.0,
        )

        self.classifier = nn.Sequential(
            nn.Dropout(0.4),
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
            nn.Sigmoid(),
        )

    def forward(self, x):
        # x: (batch, seq_len, C, H, W)
        batch_size, seq_len, C, H, W = x.size()

        # Extract CNN features for each frame
        cnn_features = []
        for t in range(seq_len):
            frame = x[:, t, :, :, :]          # (B, C, H, W)
            feat  = self.cnn(frame)            # (B, 512, 1, 1)
            feat  = feat.view(batch_size, -1)  # (B, 512)
            cnn_features.append(feat)

        # Stack → (B, seq_len, 512)
        cnn_features = torch.stack(cnn_features, dim=1)

        # LSTM → temporal dynamics
        lstm_out, _ = self.lstm(cnn_features)  # (B, seq_len, hidden)
        last_hidden  = lstm_out[:, -1, :]      # (B, hidden) — last timestep

        return self.classifier(last_hidden)    # (B, 1)


# ══════════════════════════════════════════════════════════════════════════
#  TRAINING LOOP
# ══════════════════════════════════════════════════════════════════════════

def train():
    # Dataset
    dataset = AngioDataset(DATASET_DIR, seq_len=SEQ_LEN)
    if len(dataset) == 0:
        print("\n[Error] No data found. Create dataset/ with normal/ and blocked/ subfolders.")
        print("        Each subfolder should contain video clip folders with frame images.")
        return

    loader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)

    # Model
    model     = CNN_LSTM().to(DEVICE)
    criterion = nn.BCELoss()
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()), lr=LR
    )
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=3, gamma=0.5)

    print(f"\n[Training] Starting {EPOCHS} epochs on {len(dataset)} clips...\n")

    best_loss = float('inf')

    for epoch in range(EPOCHS):
        model.train()
        total_loss, correct, total = 0.0, 0, 0

        for batch_idx, (videos, labels) in enumerate(loader):
            videos = videos.to(DEVICE)
            labels = labels.to(DEVICE).unsqueeze(1)

            outputs = model(videos)
            loss    = criterion(outputs, labels)

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            total_loss += loss.item()
            preds   = (outputs > 0.5).float()
            correct += (preds == labels).sum().item()
            total   += labels.size(0)

            if (batch_idx + 1) % 5 == 0:
                print(f"  Batch {batch_idx+1}/{len(loader)} | Loss: {loss.item():.4f}")

        avg_loss = total_loss / len(loader)
        accuracy = 100.0 * correct / max(total, 1)
        scheduler.step()

        print(f"Epoch [{epoch+1}/{EPOCHS}] | Loss: {avg_loss:.4f} | Accuracy: {accuracy:.1f}%")

        # Save best model
        if avg_loss < best_loss:
            best_loss = avg_loss
            os.makedirs(os.path.dirname(MODEL_OUT), exist_ok=True)
            torch.save({
                'epoch':       epoch + 1,
                'model_state': model.state_dict(),
                'optimizer':   optimizer.state_dict(),
                'loss':        best_loss,
            }, MODEL_OUT)
            print(f"  ✓ Best model saved → {MODEL_OUT}")

    print(f"\n[Done] Training complete. Best loss: {best_loss:.4f}")
    print(f"       Model saved to: {MODEL_OUT}")


if __name__ == "__main__":
    train()
