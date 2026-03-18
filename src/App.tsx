import os
import traceback
import cv2
import gradio as gr
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

MODEL_PATH = "models/pose_landmarker.task"

L_SHOULDER = 11
R_SHOULDER = 12
L_ELBOW = 13
R_ELBOW = 14
L_WRIST = 15
R_WRIST = 16
L_HIP = 23
R_HIP = 24
L_KNEE = 25
R_KNEE = 26
L_ANKLE = 27
R_ANKLE = 28


def get_video_path(video):
    if video is None:
        return None
    if isinstance(video, str):
        return video
    if isinstance(video, dict):
        return video.get("path")
    return None


def bgr_to_rgb(img):
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def smooth(arr, k=5):
    arr = np.asarray(arr, dtype=np.float32)
    if len(arr) < k:
        return arr
    kernel = np.ones(k, dtype=np.float32) / k
    return np.convolve(arr, kernel, "same")


def label(img, text):
    img = img.copy()
    cv2.rectangle(img, (10, 10), (360, 60), (0, 0, 0), -1)
    cv2.putText(img, text, (20, 45), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    return img


def draw_line(img, p1, p2):
    img = img.copy()
    cv2.line(img, p1, p2, (0, 255, 255), 4)
    cv2.putText(
        img,
        "Start Line",
        (min(p1[0], p2[0]) + 10, max(30, min(p1[1], p2[1]) - 10)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 255, 255),
        2,
    )
    return img


def draw_skeleton(img, r):
    img = img.copy()
    h, w = img.shape[:2]

    def pt(p):
        return int(p[0] * w), int(p[1] * h)

    links = [
        ("left_shoulder", "right_shoulder"),
        ("left_shoulder", "left_elbow"),
        ("left_elbow", "left_wrist"),
        ("right_shoulder", "right_elbow"),
        ("right_elbow", "right_wrist"),
        ("left_shoulder", "left_hip"),
        ("right_shoulder", "right_hip"),
        ("left_hip", "right_hip"),
        ("left_hip", "left_knee"),
        ("left_knee", "left_ankle"),
        ("right_hip", "right_knee"),
        ("right_knee", "right_ankle"),
    ]

    for a, b in links:
        if a in r and b in r:
            cv2.line(img, pt(r[a]), pt(r[b]), (0, 255, 0), 3)

    joints = [
        "left_shoulder", "right_shoulder",
        "left_elbow", "right_elbow",
        "left_wrist", "right_wrist",
        "left_hip", "right_hip",
        "left_knee", "right_knee",
        "left_ankle", "right_ankle",
    ]

    for j in joints:
        if j in r:
            cv2.circle(img, pt(r[j]), 5, (0, 255, 255), -1)

    return img


def create_detector():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    base = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(
        base_options=base,
        running_mode=vision.RunningMode.VIDEO,
        num_poses=1,
    )
    return vision.PoseLandmarker.create_from_options(options)


def analyse_video(path):
    if not path:
        raise ValueError("No video uploaded.")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Video file not found: {path}")

    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("Unable to open video.")

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0

    detector = create_detector()

    frames = []
    records = []

    idx = 0
    max_frames = min(150, int(fps * 5))

    while idx < max_frames:
        ok, frame = cap.read()
        if not ok:
            break

        frames.append(frame.copy())

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        ts = int((idx / fps) * 1000)

        res = detector.detect_for_video(mp_img, ts)

        if res.pose_landmarks:
            l = res.pose_landmarks[0]

            def xy(i):
                return float(l[i].x), float(l[i].y)

            rec = {
                "frame": idx,
                "left_shoulder": xy(L_SHOULDER),
                "right_shoulder": xy(R_SHOULDER),
                "left_elbow": xy(L_ELBOW),
                "right_elbow": xy(R_ELBOW),
                "left_wrist": xy(L_WRIST),
                "right_wrist": xy(R_WRIST),
                "left_hip": xy(L_HIP),
                "right_hip": xy(R_HIP),
                "left_knee": xy(L_KNEE),
                "right_knee": xy(R_KNEE),
                "left_ankle": xy(L_ANKLE),
                "right_ankle": xy(R_ANKLE),
            }

            rec["hip_x"] = (rec["left_hip"][0] + rec["right_hip"][0]) / 2
            rec["hip_y"] = (rec["left_hip"][1] + rec["right_hip"][1]) / 2
            rec["shoulder_y"] = (rec["left_shoulder"][1] + rec["right_shoulder"][1]) / 2
            rec["wrist_y"] = (rec["left_wrist"][1] + rec["right_wrist"][1]) / 2

            records.append(rec)

        idx += 1

    cap.release()
    detector.close()

    if len(frames) == 0:
        raise ValueError("No frames found in the video.")
    if len(records) < 10:
        raise ValueError("Pose could not be detected clearly. Record again with whole body visible.")

    return frames, records, fps


def find_longest_true_run(mask):
    best_start = None
    best_end = None
    cur_start = None

    for i, v in enumerate(mask):
        if v and cur_start is None:
            cur_start = i
        if not v and cur_start is not None:
            cur_end = i - 1
            if best_start is None or (cur_end - cur_start) > (best_end - best_start):
                best_start, best_end = cur_start, cur_end
            cur_start = None

    if cur_start is not None:
        cur_end = len(mask) - 1
        if best_start is None or (cur_end - cur_start) > (best_end - best_start):
            best_start, best_end = cur_start, cur_end

    return best_start, best_end


def detect_phases(records, fps):
    """
    Better auto-detection:
    1. Ignore the standing section
    2. Find the crouch block where hands are low and motion is low
    3. Mark = start of crouch block
    4. Set = highest hips inside crouch block
    5. Go = first strong motion after Set
    """
    n = len(records)
    if n < 12:
        return 0, max(1, n // 3), max(2, 2 * n // 3)

    hip_x = np.array([r["hip_x"] for r in records], dtype=np.float32)
    hip_y = np.array([r["hip_y"] for r in records], dtype=np.float32)
    shoulder_y = np.array([r["shoulder_y"] for r in records], dtype=np.float32)
    wrist_y = np.array([r["wrist_y"] for r in records], dtype=np.float32)

    hip_x_s = smooth(hip_x, 7)
    hip_y_s = smooth(hip_y, 7)
    shoulder_y_s = smooth(shoulder_y, 7)
    wrist_y_s = smooth(wrist_y, 7)

    motion = np.abs(np.diff(hip_x_s, prepend=hip_x_s[0]))
    motion = smooth(motion, 7)

    ignore = min(max(int(0.20 * fps), 2), n - 1)

    # low-motion threshold
    motion_thresh = float(np.percentile(motion[ignore:], 45)) if n > ignore else float(np.percentile(motion, 45))
    low_motion_mask = motion <= motion_thresh

    # hands low = near bottom relative to this video
    wrist_thresh = float(np.percentile(wrist_y_s[ignore:], 70)) if n > ignore else float(np.percentile(wrist_y_s, 70))
    hands_low_mask = wrist_y_s >= wrist_thresh

    # crouch block = hands low + low motion, after standing section
    crouch_mask = np.zeros(n, dtype=bool)
    crouch_mask[ignore:] = hands_low_mask[ignore:] & low_motion_mask[ignore:]

    start_run, end_run = find_longest_true_run(crouch_mask)

    if start_run is None:
        # fallback
        go_idx = int(np.argmax(motion[ignore:]) + ignore) if n > ignore else int(np.argmax(motion))
        set_idx = max(ignore, go_idx - max(3, int(0.15 * fps)))
        mark_idx = max(ignore, set_idx - max(3, int(0.15 * fps)))
        return mark_idx, set_idx, go_idx

    # Mark = first frame of crouch block
    mark_idx = start_run

    # Set = frame in crouch block with maximum hips-above-shoulders value
    hips_above_score = shoulder_y_s[start_run:end_run + 1] - hip_y_s[start_run:end_run + 1]
    set_idx = int(np.argmax(hips_above_score) + start_run)

    min_gap = max(3, int(0.10 * fps))

    # Ensure Set is after Mark
    if set_idx - mark_idx < min_gap:
        set_idx = min(end_run, mark_idx + min_gap)

    # Go = first strong motion after Set
    go_search_start = min(n - 1, set_idx + min_gap)
    if go_search_start >= n:
        go_idx = n - 1
    else:
        go_thresh = float(np.percentile(motion[go_search_start:], 80)) if n > go_search_start else float(np.max(motion))
        go_idx = None
        for i in range(go_search_start, n):
            if motion[i] >= go_thresh:
                go_idx = i
                break
        if go_idx is None:
            go_idx = int(np.argmax(motion[go_search_start:]) + go_search_start)

    # Final ordering safeguards
    if set_idx >= go_idx:
        set_idx = max(mark_idx + 1, go_idx - min_gap)
    if mark_idx >= set_idx:
        mark_idx = max(0, set_idx - min_gap)

    return int(mark_idx), int(set_idx), int(go_idx)


def load_video(video):
    try:
        path = get_video_path(video)
        if not path:
            raise ValueError("Please record or upload a video first.")

        frames, records, fps = analyse_video(path)
        mark, seti, go = detect_phases(records, fps)

        frame = frames[records[mark]["frame"]].copy()
        frame = label(frame, "Tap 2 Points on Start Line")

        state = {
            "video": path,
            "points": [],
        }

        return state, bgr_to_rgb(frame), "Tap 2 points on the start line."

    except Exception as e:
        print(traceback.format_exc())
        raise gr.Error(f"Load frame failed: {str(e)}")


def tap_line(state, evt: gr.SelectData):
    try:
        if not state or "video" not in state:
            raise ValueError("Load the video frame first.")

        path = state["video"]
        frames, records, fps = analyse_video(path)
        mark, seti, go = detect_phases(records, fps)

        frame = frames[records[mark]["frame"]].copy()

        x, y = evt.index
        pts = state.get("points", [])

        if len(pts) >= 2:
            pts = []

        pts.append((int(x), int(y)))
        state["points"] = pts

        if len(pts) == 2:
            frame = draw_line(frame, pts[0], pts[1])
            frame = label(frame, "Start Line Ready")
            msg = "Start line ready. Click Analyse Start."
        else:
            cv2.circle(frame, pts[0], 6, (0, 255, 255), -1)
            frame = label(frame, "Tap 2nd Point")
            msg = "First point selected. Tap the second point."

        return state, bgr_to_rgb(frame), msg

    except Exception as e:
        print(traceback.format_exc())
        raise gr.Error(f"Tap failed: {str(e)}")


def analyse(state):
    try:
        if not state or "video" not in state:
            raise ValueError("Load the video frame first.")
        if len(state.get("points", [])) < 2:
            raise ValueError("Tap 2 points on the start line first.")

        path = state["video"]
        p1, p2 = state["points"]

        frames, records, fps = analyse_video(path)
        mark, seti, go = detect_phases(records, fps)

        f1 = frames[records[mark]["frame"]].copy()
        f2 = frames[records[seti]["frame"]].copy()
        f3 = frames[records[go]["frame"]].copy()

        f1 = draw_skeleton(f1, records[mark])
        f2 = draw_skeleton(f2, records[seti])
        f3 = draw_skeleton(f3, records[go])

        f1 = draw_line(f1, p1, p2)

        f1 = label(f1, "On Your Mark")
        f2 = label(f2, "Set")
        f3 = label(f3, "Go")

        return bgr_to_rgb(f1), bgr_to_rgb(f2), bgr_to_rgb(f3)

    except Exception as e:
        print(traceback.format_exc())
        raise gr.Error(f"Analysis failed: {str(e)}")


with gr.Blocks() as demo:
    gr.Markdown("# Crouch Start Checker")

    state = gr.State({})

    video = gr.Video(label="Record or upload your video", sources=["upload", "webcam"])
    load_btn = gr.Button("Load Frame")
    img = gr.Image(interactive=True, label="Tap 2 points on the start line")
    info = gr.Markdown("")
    analyse_btn = gr.Button("Analyse Start")

    with gr.Row():
        mark_img = gr.Image(label="On Your Mark")
        set_img = gr.Image(label="Set")
        go_img = gr.Image(label="Go")

    load_btn.click(
        load_video,
        inputs=video,
        outputs=[state, img, info],
    )

    img.select(
        tap_line,
        inputs=state,
        outputs=[state, img, info],
    )

    analyse_btn.click(
        analyse,
        inputs=state,
        outputs=[mark_img, set_img, go_img],
    )

demo.launch(ssr_mode=False)
