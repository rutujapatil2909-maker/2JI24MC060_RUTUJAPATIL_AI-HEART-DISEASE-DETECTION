# Dataset Structure for CNN+LSTM Training

Place your angiography video frame folders here:

```
dataset/
  normal/
    patient_001/
      frame_001.jpg
      frame_002.jpg
      ...
    patient_002/
      ...
  blocked/
    patient_003/
      frame_001.jpg
      ...
```

## How to extract frames from MP4 videos

```python
import cv2, os

def extract_frames(video_path, output_dir, fps=15):
    os.makedirs(output_dir, exist_ok=True)
    cap = cv2.VideoCapture(video_path)
    count = 0
    while True:
        ret, frame = cap.read()
        if not ret: break
        if count % fps == 0:
            cv2.imwrite(f"{output_dir}/frame_{count:04d}.jpg", frame)
        count += 1
    cap.release()

# Example:
extract_frames("patient_001.mp4", "dataset/blocked/patient_001")
```

## Train the model

```bash
python model/train.py
```

Model saved to: `model/cnn_lstm_angio.pth`
