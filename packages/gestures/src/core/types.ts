export enum Finger {
  Thumb = "Thumb",
  Index = "Index",
  Middle = "Middle",
  Ring = "Ring",
  Pinky = "Pinky",
}

export enum State {
  Extended = "Extended",
  Curled = "Curled",
}

export enum Direction {
  Up = "Up",
  Down = "Down",
  Left = "Left",
  Right = "Right",
  Any = "Any",
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarks {
  handedness: "Left" | "Right";
  points: Point3D[];
}

export interface GestureEvent {
  name: string;
  confidence: number;
  hand: "left" | "right" | "both" | "any";
  direction: Direction;
  timestamp: number;
  measurements?: Record<string, number>;
}

export interface ActiveStateEvent {
  activeState: boolean;
  timestamp: number;
}

export interface Rule {
  evaluate(hands: HandLandmarks[]): {
    matches: boolean;
    confidence: number;
    direction?: Direction;
    value?: number;
  };
}

export interface WebcamOptions {
  videoElement: HTMLVideoElement;
  onFrameProcessed?: (hands: HandLandmarks[]) => void;
}
