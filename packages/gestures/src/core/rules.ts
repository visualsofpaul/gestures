import { Finger, type HandLandmarks, type Rule, State } from "@/core/types";

const FINGER_TIP_INDEX = {
  [Finger.Thumb]: 4,
  [Finger.Index]: 8,
  [Finger.Middle]: 12,
  [Finger.Ring]: 16,
  [Finger.Pinky]: 20,
};

const FINGER_JOINTS = {
  [Finger.Index]: { mcp: 5, pip: 6, dip: 7, tip: 8 },
  [Finger.Middle]: { mcp: 9, pip: 10, dip: 11, tip: 12 },
  [Finger.Ring]: { mcp: 13, pip: 14, dip: 15, tip: 16 },
  [Finger.Pinky]: { mcp: 17, pip: 18, dip: 19, tip: 20 },
};

export class FingerStateRule implements Rule {
  constructor(
    private handMode: "left" | "right" | "both" | "any",
    private finger: Finger,
    private expectedState: State,
  ) {}

  /**
   * Evaluates the state of the specified finger for the given hands.
   * @param hands An array of HandLandmarks representing the detected hands.
   * @returns An object containing whether the rule matches, the confidence level, and optionally the direction of the finger.
   */
  evaluate(hands: HandLandmarks[]) {
    const targetHands = hands.filter(
      (hand) =>
        this.handMode === "any" ||
        hand.handedness.toLowerCase() === this.handMode,
    );

    if (targetHands.length === 0) return { matches: false, confidence: 0 };

    for (const hand of targetHands) {
      // Special logic for the thumb, since it doesn't have the same joint structure as other fingers
      if (this.finger === Finger.Thumb) {
        const thumbTip = hand.points[4];
        const indexMcp = hand.points[5]; // Basis of the index finger
        const pinkyMcp = hand.points[17]; // Basis of the little finger

        if (!thumbTip || !indexMcp || !pinkyMcp) continue;

        // Calculate the hand size as the distance between the index MCP and pinky MCP
        const handSize = Math.hypot(
          indexMcp.x - pinkyMcp.x,
          indexMcp.y - pinkyMcp.y,
        );
        // Calculate the distance between the thumb tip and the index MCP
        const thumbDistance = Math.hypot(
          thumbTip.x - indexMcp.x,
          thumbTip.y - indexMcp.y,
        );

        // Determine if the thumb is extended based on its distance from the index MCP relative to the hand size
        const isExtended = thumbDistance > handSize * 0.6;
        const actualState = isExtended ? State.Extended : State.Curled;

        if (actualState === this.expectedState) {
          const confidence = isExtended
            ? Math.min(1, thumbDistance / handSize)
            : Math.max(0, 1 - thumbDistance / handSize);
          return { matches: true, confidence };
        }
        return { matches: false, confidence: 0 };
      }

      // For other fingers, we can use the joint angles to determine if they are curled or extended
      const joints = FINGER_JOINTS[this.finger as keyof typeof FINGER_JOINTS];
      if (!joints) continue;

      const p1 = hand.points[joints.mcp];
      const p2 = hand.points[joints.pip];
      const p3 = hand.points[joints.tip];

      if (!p1 || !p2 || !p3) continue;

      const v1 = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z };
      const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
      const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
      const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);

      const angle = Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
      const curling = Math.max(0, Math.min(1, (160 - angle) / 80));

      const actualState = curling > 0.55 ? State.Curled : State.Extended;

      if (actualState === this.expectedState) {
        const confidence =
          this.expectedState === State.Curled ? curling : 1 - curling;
        return { matches: true, confidence };
      }
    }

    return { matches: false, confidence: 0 };
  }
}

export type DistanceMode = "min" | "max";

export class FingerDistanceRule implements Rule {
  constructor(
    private handMode: "left" | "right" | "both" | "any",
    private fingerA: Finger,
    private fingerB: Finger,
    private thresholdRatio: number, // Threshold value relative to the hand size
    private mode: DistanceMode = "max",
  ) {}

  /**
   * Evaluates the distance between two specified fingers for the given hands.
   * @param hands An array of HandLandmarks representing the detected hands.
   * @returns An object containing whether the rule matches, the confidence level, the raw distance value, and optionally the direction of the finger.
   */
  evaluate(hands: HandLandmarks[]) {
    const targetHands = hands.filter(
      (hand) =>
        this.handMode === "any" ||
        hand.handedness.toLowerCase() === this.handMode,
    );

    if (targetHands.length === 0) return { matches: false, confidence: 0 };
    const hand = targetHands[0];

    const tipA = hand?.points[FINGER_TIP_INDEX[this.fingerA]];
    const tipB = hand?.points[FINGER_TIP_INDEX[this.fingerB]];
    const indexMcp = hand?.points[5];
    const pinkyMcp = hand?.points[17];

    if (!tipA || !tipB || !indexMcp || !pinkyMcp)
      return { matches: false, confidence: 0 };

    // Calculate the hand size as the distance between the index MCP and pinky MCP
    const handSize = Math.hypot(
      indexMcp.x - pinkyMcp.x,
      indexMcp.y - pinkyMcp.y,
    );
    // Calculate the distance between the two finger tips
    const distance = Math.hypot(tipA.x - tipB.x, tipA.y - tipB.y);

    const distanceRatio = distance / handSize;

    // Determine if the distance ratio meets the threshold based on the specified mode
    const matches =
      this.mode === "max"
        ? distanceRatio <= this.thresholdRatio
        : distanceRatio >= this.thresholdRatio;

    // Calculate confidence based on how clearly the ratio meets or fails the threshold, providing a measure of certainty in the evaluation
    const confidence = matches
      ? this.mode === "max"
        ? Math.max(0, 1 - distanceRatio / this.thresholdRatio)
        : Math.max(
            0,
            Math.min(
              1,
              (distanceRatio - this.thresholdRatio) / this.thresholdRatio,
            ),
          )
      : 0;

    return { matches, confidence, value: distanceRatio };
  }
}
