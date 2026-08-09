import Reveal from "reveal.js";
// @ts-expect-error
import "reveal.js/reveal.css";
// @ts-expect-error
import "reveal.js/theme/black.css";

import {
  Finger,
  Gesture,
  GestureEngine,
  type GestureEvent,
  State,
} from "gestures";
import { Presets } from "gestures/presets";

const isCameraManuallyHidden = false;

// Step 1: Initialize Gesture Engine
const engine = new GestureEngine<never, true>({
  enableTwoHandGestures: true,
  startActive: false, // Make sure to start in an inactive state, so the user can activate it with a gesture
})
  .register(
    Presets.ThumbsUp("ThumbsUp").holdFor(1000).idleFor(2000).asSystemGesture(),
  )
  .register(Presets.Gun("Navigate").idleFor(1000))
  .register(Presets.Peace("PeaceConfirm").holdFor(1500).idleFor(2000))
  .register(Presets.PinkyPinch("PinkyPinch"))
  .register(
    Gesture.create("PinchZoom")
      .where.anyHand()
      .has(Finger.Thumb)
      .inState(State.Extended)
      .has(Finger.Index)
      .inState(State.Extended)
      .tracks(Finger.Thumb, Finger.Index, "zoomDistance"),
  )
  .register(Presets.Fist("Fist").idleFor(2000));

// DOM Elements
const webcamContainer = document.getElementById(
  "webcam-container",
) as HTMLDivElement;
const webcamVideo = document.getElementById("webcam") as HTMLVideoElement;

engine.bindWebcam({ videoElement: webcamVideo });
Reveal.initialize({ hash: true, controls: true, progress: true });

// Step 2: Gesture to Toggle Engine Active State
engine.onGestures("ThumbsUp", "ThumbsUp", () => {
  engine.toggleActiveState();
});

// Step 3: Directional Navigation
engine.onGesture("Navigate", (event: GestureEvent) => {
  if (!Reveal.isReady()) return;

  switch (event.direction) {
    case "Left":
      Reveal.left();
      break;
    case "Right":
      Reveal.right();
      break;
    case "Up":
      Reveal.up();
      break;
    case "Down":
      Reveal.down();
      break;
  }
});

// Step 4: Pinch Zoom
engine.onGestures("PinkyPinch", "PinchZoom", (_, eventB: GestureEvent) => {
  const currentSlide = Reveal.getCurrentSlide();
  const zoomTarget = currentSlide?.querySelector<HTMLElement>("#zoom-target");

  if (zoomTarget && eventB.measurements?.zoomDistance !== undefined) {
    const rawDistance = eventB.measurements.zoomDistance;
    const scale = Math.max(0.3, Math.min(0.3 + rawDistance * 3.5, 2.5));
    zoomTarget.style.transform = `scale(${scale})`;
  }
});

// Step 5: Reset Zoom on Double Fist Gesture
engine.onGestures("Fist", "Fist", () => {
  const currentSlide = Reveal.getCurrentSlide();
  const zoomTarget = currentSlide?.querySelector<HTMLElement>("#zoom-target");

  if (zoomTarget) {
    zoomTarget.style.transform = `scale(0.3)`;
  }
});

// Step 6: Peace Gesture Confirmation
engine.onGesture("PeaceConfirm", () => {
  const currentSlide = Reveal.getCurrentSlide();
  const confirmBox = currentSlide?.querySelector<HTMLElement>(".confirm-box");
  if (confirmBox) {
    confirmBox.style.backgroundColor = "#2e7d32";
    confirmBox.textContent = "Geste 1.5s gehalten!";
  }
});

// Step 7: Webcam Visibility Toggle
function updateWebcamVisibility(engineIsActive: boolean) {
  if (isCameraManuallyHidden || engineIsActive) {
    webcamContainer.classList.add("hidden");
  } else {
    webcamContainer.classList.remove("hidden");
  }
}

engine.onActiveState((event) => {
  updateWebcamVisibility(event.activeState);

  showToast(event.activeState ? "🟢 Engine Active" : "🔴 Engine Paused");
});

// Helper: Toast UI
function showToast(message: string) {
  let alert = document.getElementById("active-toast");
  if (!alert) {
    alert = document.createElement("div");
    alert.id = "active-toast";
    Object.assign(alert.style, {
      position: "fixed",
      bottom: "32px",
      left: "50%",
      transform: "translateX(-50%) translateY(16px)",
      padding: "16px 32px",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      backdropFilter: "blur(16px)",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
      fontSize: "16px",
      borderRadius: "9999px",
      zIndex: "10000",
      opacity: "0",
      transition: "opacity 0.3s ease, transform 0.3s ease",
      pointerEvents: "none",
    });
    document.body.appendChild(alert);
  }

  alert.textContent = message;
  requestAnimationFrame(() => {
    alert.style.opacity = "1";
    alert.style.transform = "translateX(-50%) translateY(0)";
  });

  setTimeout(() => {
    alert.style.opacity = "0";
    alert.style.transform = "translateX(-50%) translateY(20px)";
  }, 2200);
}
