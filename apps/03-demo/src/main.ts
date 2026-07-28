import {
  Finger,
  Gesture,
  GestureEngine,
  type GestureEvent,
  State,
} from "gestures";
import { Presets } from "gestures/presets";

const engine = new GestureEngine({
  enableTwoHandGestures: true,
})
  .register(
    Presets.ThumbsUp("ThumbsUp").asSystemGesture().holdFor(1000).idleFor(2000),
  )
  .register(Presets.Pointer("Pointer").holdFor(2000))
  .register(Presets.Gun("Gun"))
  .register(Presets.PinkyPinch("PinkyPinch"))
  .register(Presets.Fist("Fist").holdFor(2000))
  .register(Presets.Peace("Peace").idleFor(2000))
  .register(
    Gesture.create("MiddleFinger")
      .where.anyHand()
      .has(Finger.Middle)
      .inState(State.Extended)
      .has(Finger.Thumb)
      .inState(State.Curled)
      .has(Finger.Index)
      .inState(State.Curled)
      .has(Finger.Ring)
      .inState(State.Curled)
      .has(Finger.Pinky)
      .inState(State.Curled)
      .where.determineDirectionFrom(Finger.Middle)
      .idleFor(2000),
  )
  .register(
    Gesture.create("PinchZoom")
      .where.anyHand()
      .has(Finger.Thumb)
      .inState(State.Extended)
      .has(Finger.Index)
      .inState(State.Extended)
      .tracks(Finger.Thumb, Finger.Index, "zoomDistance"),
  );

engine.bindWebcam({
  videoElement: document.getElementById("webcam") as HTMLVideoElement,
});

engine.onGesture("ThumbsUp", (event: GestureEvent) => {
  console.log("👍", event);
});

engine.onGesture("Pointer", (event: GestureEvent) => {
  console.log("☝️", event);
});

engine.onGesture("Gun", (event: GestureEvent) => {
  console.log("🔫", event);
});

engine.onGesture("PinkyPinch", (event: GestureEvent) => {
  console.log("🤏", event);
});

engine.onGesture("Fist", (event: GestureEvent) => {
  console.log("✊", event);
});

engine.onGesture("Peace", (event: GestureEvent) => {
  console.log("✌️", event);
});

engine.onGesture("MiddleFinger", (event: GestureEvent) => {
  console.log("🖕", event);
});

engine.onGestures(
  "ThumbsUp",
  "ThumbsUp",
  (eventA: GestureEvent, eventB: GestureEvent) => {
    console.log("👍👍", eventA, eventB);
    engine.toggleActiveState();
  },
);

engine.onGestures(
  "Fist",
  "Fist",
  (eventA: GestureEvent, eventB: GestureEvent) => {
    console.log("✊✊", eventA, eventB);
  },
);

engine.onGestures("PinkyPinch", "PinchZoom", (_, eventB: GestureEvent) => {
  const distance = eventB.measurements?.zoomDistance;
  const box = document.getElementById("zoom-box");
  if (box && distance !== undefined) {
    box.style.transform = `scale(${distance})`;
  }
});

engine.onActiveState((event) => {
  console.log("Gesture detection active state changed:", event.activeState);
});
