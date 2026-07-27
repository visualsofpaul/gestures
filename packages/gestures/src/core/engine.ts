import type { GestureBuilder } from "@/core/builder";
import { FingerStateRule } from "@/core/rules";
import {
  type ActiveStateEvent,
  Direction,
  type GestureEvent,
  type HandLandmarks,
  State,
  type WebcamOptions,
} from "@/core/types";
import { calculateFingerDirection } from "@/core/utils";

const FINGER_MCP_INDEX = { Thumb: 2, Index: 5, Middle: 9, Ring: 13, Pinky: 17 };

interface FrameMatch {
  hand: "Left" | "Right";
  direction: Direction;
  confidence: number;
}

interface TwoHandListener {
  nameA: string;
  nameB: string;
  callback: (eventA: GestureEvent, eventB: GestureEvent) => void;
}

// A way to conditionally type the onGestures method based on whether two-hand gestures are enabled or not. If two-hand gestures are enabled, the method will be available; otherwise, it will be undefined.
export interface GestureEngineOptions<
  TwoHandGesturesEnabled extends boolean = false,
> {
  enableTwoHandGestures?: TwoHandGesturesEnabled;
}

type OnGesturesMethod<
  RegisteredGestures extends string,
  TwoHandGesturesEnabled extends boolean,
> = TwoHandGesturesEnabled extends true
  ? (
      nameA: RegisteredGestures,
      nameB: RegisteredGestures,
      callback: (eventA: GestureEvent, eventB: GestureEvent) => void,
    ) => void
  : undefined;

export class GestureEngine<
  RegisteredGestures extends string = never,
  TwoHandGesturesEnabled extends boolean = false,
> {
  private _isActive: boolean = false;
  private gestures = new Map<string, GestureBuilder<string>>();
  private gestureListeners = new Map<
    string,
    Array<(event: GestureEvent) => void>
  >();
  private activeStateListeners: Array<(event: ActiveStateEvent) => void> = [];
  private lastTriggeredTimestamps = new Map<string, number>();
  private gestureStates = new Map<string, "waiting" | "ready">();

  private firstDetectedTimestamps = new Map<string, number>();
  private lastIdleTimestamps = new Map<string, number>();

  private readonly twoHandGesturesEnabled: boolean;
  private twoHandListeners: TwoHandListener[] = [];
  private comboStates = new Map<string, "waiting" | "active">();
  private twoHandFirstDetectedTimestamps = new Map<string, number>();

  public readonly onGestures: OnGesturesMethod<
    RegisteredGestures,
    TwoHandGesturesEnabled
  >;

  private videoElement: HTMLVideoElement | null = null;
  private handsDetector:
    | import("@mediapipe/tasks-vision").HandLandmarker
    | null = null;

  /**
   * @param options An object containing configuration options for the GestureEngine. The enableTwoHandGestures property allows you to enable or disable two-hand gesture detection. If enabled, the onGestures method will be available for registering two-hand gesture callbacks.
   */
  constructor(options: GestureEngineOptions<TwoHandGesturesEnabled> = {}) {
    this.twoHandGesturesEnabled = options.enableTwoHandGestures ?? false;

    this.onGestures = (
      this.twoHandGesturesEnabled
        ? (
            nameA: string,
            nameB: string,
            callback: (eventA: GestureEvent, eventB: GestureEvent) => void,
          ) => {
            this.twoHandListeners.push({ nameA, nameB, callback });
          }
        : undefined
    ) as OnGesturesMethod<RegisteredGestures, TwoHandGesturesEnabled>;
  }

  /**
   * Returns whether the gesture engine is currently active. When active, it will process webcam frames and detect gestures. When inactive, it will skip gesture detection to save resources.
   * @returns True if the engine is active, false otherwise.
   */
  public get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Registers a new gesture with the engine. The gesture is defined using a GestureBuilder instance. Once registered, the engine will start detecting this gesture in the webcam feed.
   * @param gesture The GestureBuilder instance defining the gesture to register.
   * @returns The GestureEngine instance, allowing for method chaining.
   */
  public register<NewName extends string>(
    gesture: GestureBuilder<NewName>,
  ): GestureEngine<RegisteredGestures | NewName, TwoHandGesturesEnabled> {
    this.gestures.set(gesture.name, gesture);
    return this as unknown as GestureEngine<
      RegisteredGestures | NewName,
      TwoHandGesturesEnabled
    >;
  }

  /**
   * Activates the gesture engine, allowing it to process webcam frames and detect gestures. If the engine is already active, this method has no effect.
   */
  public startActiveState(): void {
    if (!this._isActive) {
      this._isActive = true;
      this.emitActiveState();
    }
  }

  /**
   * Deactivates the gesture engine, preventing it from processing webcam frames and detecting gestures. If the engine is already inactive, this method has no effect.
   */
  public stopActiveState(): void {
    if (this._isActive) {
      this._isActive = false;
      this.emitActiveState();
    }
  }

  /**
   * Toggles the active state of the gesture engine. If the engine is currently active, it will be deactivated, and vice versa. This method is useful for quickly enabling or disabling gesture detection without needing to call startActiveState() or stopActiveState() directly.
   */
  public toggleActiveState(): void {
    this._isActive = !this._isActive;
    this.emitActiveState();
  }

  /**
   * Registers a callback function to be invoked whenever a specific gesture is detected. The callback receives a GestureEvent object containing details about the detected gesture, such as its name, confidence level, hand used, direction, and timestamp.
   * @param name The name of the gesture to listen for. This should match the name defined in the GestureBuilder when the gesture was registered.
   * @param callback The function to be called when the gesture is detected.
   */
  public onGesture(
    name: RegisteredGestures,
    callback: (event: GestureEvent) => void,
  ): void {
    // Ensure that the gesture name is registered before adding a listener
    if (!this.gestureListeners.has(name)) {
      this.gestureListeners.set(name, []);
    }
    this.gestureListeners.get(name)?.push(callback);
  }

  /**
   * Registers a callback function to be invoked whenever the active state of the gesture engine changes. The callback receives an ActiveStateEvent object containing details about the new active state and the timestamp of the change.
   * @param callback The function to be called when the active state changes.
   */
  public onActiveState(callback: (event: ActiveStateEvent) => void): void {
    this.activeStateListeners.push(callback);
  }

  /**
   * Emits an ActiveStateEvent to all registered listeners, indicating the current active state of the gesture engine. This method is called internally whenever the active state changes, ensuring that all listeners are notified of the change.
   */
  private emitActiveState(): void {
    const event: ActiveStateEvent = {
      activeState: this._isActive,
      timestamp: Date.now(),
    };
    this.activeStateListeners.forEach((listener) => {
      listener(event);
    });
  }

  /**
   * Binds the gesture engine to a webcam feed, allowing it to process video frames and detect gestures in real-time. This method initializes the MediaPipe HandLandmarker, sets up the webcam stream, and starts the detection loop. An optional callback can be provided to receive the processed hand landmarks for each frame.
   * @param options An object containing the HTMLVideoElement to bind to and an optional callback function to be called after each frame is processed.
   * @returns A Promise that resolves when the webcam is successfully bound and the detection loop has started.
   */
  public async bindWebcam(options: WebcamOptions): Promise<void> {
    this.videoElement = options.videoElement;

    // Step 1: Import MediaPipe
    const { FilesetResolver, HandLandmarker } =
      await import("@mediapipe/tasks-vision");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
    );

    this.handsDetector = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU", // Use GPU for better performance, if available
      },
      runningMode: "VIDEO",
      numHands: this.twoHandGesturesEnabled ? 2 : 1, // Important to allow multi-hand gestures
    });

    // Step 2: Activate the webcam and start processing frames
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: { ideal: 30 } },
      audio: false,
    });

    this.videoElement.srcObject = stream;

    this.videoElement.addEventListener("loadeddata", () => {
      this.videoElement?.play();
      this.startDetectionLoop(options.onFrameProcessed);
    });
  }

  /**
   * Filters the detected hands to find all hands that match the base pose rules defined in the provided GestureBuilder.
   * @param hands An array of HandLandmarks representing the detected hands in the current frame.
   * @param gestureBuilder The GestureBuilder instance defining the gesture to match against the detected hands.
   * @returns An array of HandLandmarks objects that match the base pose rules, or an empty array if no matching hands are found.
   */
  private findAllMatchingHands(
    hands: HandLandmarks[],
    gestureBuilder: GestureBuilder<string>,
  ): HandLandmarks[] {
    return hands.filter((hand) =>
      gestureBuilder.basePoseRules.every(
        (rule) => rule.evaluate([hand]).matches,
      ),
    );
  }

  /**
   * Finds a hand from the detected hands that matches the base pose rules defined in the provided GestureBuilder.
   * @param hands An array of HandLandmarks representing the detected hands in the current frame.
   * @param gestureBuilder The GestureBuilder instance defining the gesture to match against the detected hands.
   * @returns The first HandLandmarks object that matches the base pose rules, or null if no matching hand is found.
   */
  private findMatchingHand(
    hands: HandLandmarks[],
    gestureBuilder: GestureBuilder<string>,
  ): HandLandmarks | null {
    return this.findAllMatchingHands(hands, gestureBuilder)[0] ?? null;
  }

  /**
   * Finds all hands from the detected hands that match both the base pose rules and the expected direction defined in the provided GestureBuilder. This method first filters the hands based on the base pose rules, then calculates the direction of the dominant finger for each matching hand, and finally filters out any hands that do not match the expected direction.
   * @param hands An array of HandLandmarks representing the detected hands in the current frame.
   * @param gestureBuilder The GestureBuilder instance defining the gesture to match against the detected hands, including the expected direction.
   * @returns An array of FrameMatch objects representing the hands that match both the base pose rules and the expected direction, or an empty array if no matching hands are found.
   */
  private findAllMatchingHandsWithDirection(
    hands: HandLandmarks[],
    gestureBuilder: GestureBuilder<string>,
  ): FrameMatch[] {
    const mcpIndex =
      FINGER_MCP_INDEX[
        gestureBuilder.dominantFinger as keyof typeof FINGER_MCP_INDEX
      ] || 5;

    return this.findAllMatchingHands(hands, gestureBuilder)
      .map((hand) => ({
        hand: hand.handedness,
        direction: calculateFingerDirection(hand, mcpIndex),
        confidence: 1.0,
      }))
      .filter(
        (match) =>
          gestureBuilder.expectedDirection === Direction.Any ||
          match.direction === gestureBuilder.expectedDirection,
      );
  }

  /**
   * Filters the detected hands to find those that have been held in the matching pose for at least the specified hold duration. This method maintains a timestamp for each hand and gesture combination, allowing it to determine how long each hand has been in the matching pose. Hands that have not been held long enough are filtered out.
   * @param matches An array of FrameMatch objects representing the hands that match the base pose rules and expected direction.
   * @param gestureName The name of the gesture being evaluated, used to track timestamps for each hand and gesture combination.
   * @param holdDurationMs The minimum duration (in milliseconds) that a hand must be held in the matching pose to be considered a valid match.
   * @returns An array of FrameMatch objects representing the hands that have been held in the matching pose for at least the specified hold duration, or an empty array if no hands meet the criteria.
   */
  private filterByHoldDuration(
    matches: FrameMatch[],
    gestureName: string,
    holdDurationMs: number,
  ): FrameMatch[] {
    const now = Date.now();
    const matchedKeys = new Set(
      matches.map((match) => `${gestureName}:${match.hand}`),
    );

    // Clean up old timestamps for hands that are no longer matching the gesture
    for (const key of this.twoHandFirstDetectedTimestamps.keys()) {
      if (key.startsWith(`${gestureName}:`) && !matchedKeys.has(key)) {
        this.twoHandFirstDetectedTimestamps.delete(key);
      }
    }

    return matches.filter((match) => {
      const key = `${gestureName}:${match.hand}`;
      if (!this.twoHandFirstDetectedTimestamps.has(key)) {
        this.twoHandFirstDetectedTimestamps.set(key, now);
      }
      const startedAt = this.twoHandFirstDetectedTimestamps.get(key) as number;
      return now - startedAt >= holdDurationMs;
    });
  }

  /**
   * Finds a pair of hands from two sets of matching hands that are disjoint, meaning they belong to different hands (one left and one right). This method is used to evaluate two-hand gestures, ensuring that the detected hands for each gesture do not overlap. If a valid pair is found, it returns an object containing the two FrameMatch objects; otherwise, it returns null.
   * @param matchesA An array of FrameMatch objects representing the hands that match the first gesture in a two-hand gesture combination.
   * @param matchesB An array of FrameMatch objects representing the hands that match the second gesture in a two-hand gesture combination.
   * @returns An object containing the two FrameMatch objects if a disjoint pair is found, or null if no valid pair exists.
   */
  private findDisjointHandPair(
    matchesA: FrameMatch[],
    matchesB: FrameMatch[],
  ): { a: FrameMatch; b: FrameMatch } | null {
    for (const a of matchesA) {
      for (const b of matchesB) {
        if (a.hand !== b.hand) return { a, b };
      }
    }
    return null;
  }

  /**
   * Checks whether all trigger fingers defined in the GestureBuilder are curled for a given hand. This method evaluates each trigger finger using the FingerStateRule and calculates the average confidence of the curled state. If any trigger finger is not curled, it returns false along with a confidence of 0. If all trigger fingers are curled, it returns true along with the average confidence.
   * @param hand The hand landmarks to evaluate.
   * @param gestureBuilder The gesture builder containing the trigger finger information.
   * @returns An object indicating whether all trigger fingers are curled and the average confidence.
   */
  private checkTriggerFingersCurled(
    hand: HandLandmarks,
    gestureBuilder: GestureBuilder<string>,
  ): { areCurled: boolean; avgConfidence: number } {
    if (gestureBuilder.triggerFingers.length === 0) {
      return { areCurled: true, avgConfidence: 1.0 };
    }

    let sumConfidence = 0;
    for (const finger of gestureBuilder.triggerFingers) {
      const check = new FingerStateRule(
        gestureBuilder.targetHandMode,
        finger,
        State.Curled,
      ).evaluate([hand]);

      if (!check.matches) {
        return { areCurled: false, avgConfidence: 0 };
      }
      sumConfidence += check.confidence;
    }

    return {
      areCurled: true,
      avgConfidence: sumConfidence / gestureBuilder.triggerFingers.length,
    };
  }

  /**
   * Processes all registered two-hand gesture listeners by evaluating the detected hands against the defined gestures. This method checks for matching hands for each gesture, applies hold duration filtering, and determines if a valid pair of hands exists for the two-hand gesture. If a valid pair is found and meets the cooldown requirements, the registered callback is invoked with the corresponding GestureEvent objects for each hand. The method returns a set of hand sides that have been consumed by two-hand gestures to prevent overlapping detections.
   * @param hands An array of HandLandmarks representing the detected hands in the current frame.
   * @returns A set of hand sides ("Left" or "Right") that have been consumed by two-hand gestures, preventing them from being used in single-hand gesture detections.
   */
  private processTwoHandListeners(
    hands: HandLandmarks[],
  ): Set<"Left" | "Right"> {
    const consumedHandSides = new Set<"Left" | "Right">();

    for (const { nameA, nameB, callback } of this.twoHandListeners) {
      const comboKey = `${nameA}+${nameB}`;
      const builderA = this.gestures.get(nameA);
      const builderB = this.gestures.get(nameB);

      if (!builderA || !builderB) continue;

      const rawMatchesA = this.findAllMatchingHandsWithDirection(
        hands,
        builderA,
      );
      const rawMatchesB = this.findAllMatchingHandsWithDirection(
        hands,
        builderB,
      );

      const matchesA = this.filterByHoldDuration(
        rawMatchesA,
        nameA,
        builderA.holdDurationMs ?? 0,
      );
      const matchesB = this.filterByHoldDuration(
        rawMatchesB,
        nameB,
        builderB.holdDurationMs ?? 0,
      );

      const pair =
        matchesA.length > 0 && matchesB.length > 0
          ? this.findDisjointHandPair(matchesA, matchesB)
          : null;

      if (!pair) {
        this.comboStates.set(comboKey, "waiting");
        continue;
      }

      // Check if either gesture has trigger fingers defined, indicating a dynamic combo
      const hasTriggerA = builderA.triggerFingers.length > 0;
      const hasTriggerB = builderB.triggerFingers.length > 0;
      const isDynamicCombo = hasTriggerA || hasTriggerB;

      // If it's a dynamic combo, we need to check the trigger finger states for both hands
      const handObjA = hands.find((h) => h.handedness === pair.a.hand);
      const handObjB = hands.find((h) => h.handedness === pair.b.hand);

      if (!handObjA || !handObjB) {
        this.comboStates.set(comboKey, "waiting");
        continue;
      }

      const triggerStatusA = this.checkTriggerFingersCurled(handObjA, builderA);
      const triggerStatusB = this.checkTriggerFingersCurled(handObjB, builderB);

      const currentState = this.comboStates.get(comboKey) ?? "waiting";

      // Special case: If it's a dynamic combo, we need to handle the trigger finger states and cooldowns
      if (isDynamicCombo) {
        // State 1: Trigger-Finger is NOT curled (ready to fire)
        const triggerReadyA = !hasTriggerA || !triggerStatusA.areCurled;
        const triggerReadyB = !hasTriggerB || !triggerStatusB.areCurled;

        if (triggerReadyA && triggerReadyB) {
          this.comboStates.set(comboKey, "waiting");
          // Mark the hands as consumed to prevent them from being used in other gestures
          consumedHandSides.add(pair.a.hand);
          consumedHandSides.add(pair.b.hand);
          continue;
        }

        // State 2: Trigger-Finger is curled (ready to fire)
        if (currentState !== "waiting") {
          // If the combo is already in "active" state, we don't want to fire again until the trigger fingers are released and curled again. So we skip this frame.
          consumedHandSides.add(pair.a.hand);
          consumedHandSides.add(pair.b.hand);
          continue;
        }

        // Check if the average confidence of the trigger fingers meets the required threshold for both hands. If not, we skip this frame.
        if (
          (hasTriggerA &&
            triggerStatusA.avgConfidence < builderA.targetConfidence) ||
          (hasTriggerB &&
            triggerStatusB.avgConfidence < builderB.targetConfidence)
        ) {
          continue;
        }
      }

      consumedHandSides.add(pair.a.hand);
      consumedHandSides.add(pair.b.hand);

      const now = Date.now();
      const lastTriggered = this.lastTriggeredTimestamps.get(comboKey) || 0;
      const cooldown = Math.max(
        builderA.cooldownMs ?? 0,
        builderB.cooldownMs ?? 0,
      );

      if (now - lastTriggered >= cooldown) {
        const eventA: GestureEvent = {
          name: nameA,
          confidence: pair.a.confidence,
          hand: pair.a.hand.toLowerCase() as "left" | "right",
          direction: pair.a.direction,
          timestamp: now,
        };
        const eventB: GestureEvent = {
          name: nameB,
          confidence: pair.b.confidence,
          hand: pair.b.hand.toLowerCase() as "left" | "right",
          direction: pair.b.direction,
          timestamp: now,
        };

        callback(eventA, eventB);

        this.lastTriggeredTimestamps.set(comboKey, now);
        this.twoHandFirstDetectedTimestamps.set(`${nameA}:${pair.a.hand}`, now);
        this.twoHandFirstDetectedTimestamps.set(`${nameB}:${pair.b.hand}`, now);
        this.comboStates.set(comboKey, isDynamicCombo ? "waiting" : "active");
      }
    }

    return consumedHandSides;
  }

  /**
   * Starts the detection loop that continuously processes video frames from the webcam and detects gestures. This method uses requestAnimationFrame to ensure smooth and efficient frame processing. It transforms the raw hand landmarks and handedness data into a more usable format and calls the processFrame method to evaluate registered gestures.
   * @param onFrameProcessed An optional callback function that is called after each frame is processed, receiving the transformed hand landmarks as an argument.
   */
  private startDetectionLoop(
    onFrameProcessed?: (hands: HandLandmarks[]) => void,
  ): void {
    const predict = () => {
      // Safety check to ensure videoElement and handsDetector are initialized
      if (!this.videoElement || !this.handsDetector) return;

      const timestamp = performance.now();
      const results = this.handsDetector.detectForVideo(
        this.videoElement,
        timestamp,
      );

      const transformedHands: HandLandmarks[] = [];

      if (results.landmarks && results.handedness) {
        for (let i = 0; i < results.landmarks.length; i++) {
          const handednessLabel = results.handedness[i]?.[0]?.categoryName;
          const landmarkPoints = results.landmarks[i];

          if (!landmarkPoints) {
            continue;
          }

          transformedHands.push({
            handedness: handednessLabel as "Left" | "Right",
            points: landmarkPoints,
          });
        }
      }

      // Step 3: Call the optional callback with the transformed hands
      this.processFrame(transformedHands);

      if (onFrameProcessed) {
        onFrameProcessed(transformedHands);
      }

      requestAnimationFrame(predict);
    };

    requestAnimationFrame(predict);
  }

  /**
   * Processes a single frame of hand landmarks to evaluate registered gestures.
   * @param hands An array of HandLandmarks representing the detected hands in the current frame.
   */
  private processFrame(hands: HandLandmarks[]): void {
    const consumedHandSides = this.twoHandGesturesEnabled
      ? this.processTwoHandListeners(hands)
      : new Set<"Left" | "Right">();

    for (const [name, gestureBuilder] of this.gestures.entries()) {
      if (!this._isActive && !gestureBuilder.isSystemTrigger) {
        this.gestureStates.set(name, "waiting");
        continue;
      }

      const matchingHands = hands.filter(
        (hand) =>
          (gestureBuilder.targetHandMode === "any" ||
            hand.handedness.toLowerCase() === gestureBuilder.targetHandMode) &&
          !consumedHandSides.has(hand.handedness),
      );

      const activeHand = this.findMatchingHand(matchingHands, gestureBuilder);

      const mcpIndex =
        FINGER_MCP_INDEX[
          gestureBuilder.dominantFinger as keyof typeof FINGER_MCP_INDEX
        ] || 5;

      let currentHandDirection: Direction = Direction.Any;
      let directionMatches = false;

      if (activeHand) {
        currentHandDirection = calculateFingerDirection(activeHand, mcpIndex);
        directionMatches =
          gestureBuilder.expectedDirection === Direction.Any ||
          currentHandDirection === gestureBuilder.expectedDirection;
      }

      const poseOk = activeHand !== null && directionMatches;

      let triggerFingersAreCurled = true;
      let triggerConfidenceSum = 0;
      if (activeHand && gestureBuilder.triggerFingers.length > 0) {
        for (const finger of gestureBuilder.triggerFingers) {
          const checkCurled = new FingerStateRule(
            gestureBuilder.targetHandMode,
            finger,
            State.Curled,
          ).evaluate([activeHand]);
          if (!checkCurled.matches) {
            triggerFingersAreCurled = false;
            break;
          }
          triggerConfidenceSum += checkCurled.confidence;
        }
      }

      const currentState = this.gestureStates.get(name) || "waiting";
      const now = Date.now();
      const lastTriggered = this.lastTriggeredTimestamps.get(name) || 0;

      const holdFor = gestureBuilder.holdDurationMs ?? 0;
      const idleFor = gestureBuilder.cooldownMs ?? 0;

      let basePoseHeldLongEnough = false;
      if (poseOk) {
        if (!this.firstDetectedTimestamps.has(name)) {
          this.firstDetectedTimestamps.set(name, now);
        }
        this.lastIdleTimestamps.delete(name);
        const startedAt = this.firstDetectedTimestamps.get(name) || now;
        basePoseHeldLongEnough = now - startedAt >= holdFor;
      } else {
        if (this.firstDetectedTimestamps.has(name)) {
          this.firstDetectedTimestamps.delete(name);
        }
        if (!this.lastIdleTimestamps.has(name)) {
          this.lastIdleTimestamps.set(name, now);
        }
        const idleStartedAt = this.lastIdleTimestamps.get(name) || now;
        const idleElapsed = now - idleStartedAt;
        if (idleFor > 0 && idleElapsed < idleFor) {
          continue;
        }
        this.lastIdleTimestamps.delete(name);
      }

      // Option 1: Static gesture without trigger fingers
      if (gestureBuilder.triggerFingers.length === 0) {
        if (poseOk && basePoseHeldLongEnough) {
          if (now - lastTriggered >= gestureBuilder.cooldownMs) {
            this.emitGesture(
              name,
              1.0,
              activeHand
                ? (activeHand.handedness.toLowerCase() as "left" | "right")
                : gestureBuilder.targetHandMode,
              currentHandDirection,
            );
            this.lastTriggeredTimestamps.set(name, now);
            this.firstDetectedTimestamps.set(name, now);
          }
        }
        if (!poseOk) {
          this.gestureStates.set(name, "waiting");
        }
      }

      // Option 2: Dynamic gesture with trigger fingers
      else {
        if (!poseOk) {
          // Hand is not in the base pose or direction does not match
          this.gestureStates.set(name, "waiting");
        } else if (!triggerFingersAreCurled && basePoseHeldLongEnough) {
          // Hand is in the base pose and direction matches, but trigger fingers are not curled
          this.gestureStates.set(name, "ready");
        } else if (
          currentState === "ready" &&
          triggerFingersAreCurled &&
          basePoseHeldLongEnough
        ) {
          // Hand is in the base pose and direction matches, trigger fingers are curled, and the gesture is ready to fire
          if (now - lastTriggered >= gestureBuilder.cooldownMs) {
            const avgTriggerConfidence =
              triggerConfidenceSum / gestureBuilder.triggerFingers.length;

            if (avgTriggerConfidence >= gestureBuilder.targetConfidence) {
              this.emitGesture(
                name,
                avgTriggerConfidence,
                activeHand
                  ? (activeHand.handedness.toLowerCase() as "left" | "right")
                  : gestureBuilder.targetHandMode,
                currentHandDirection,
              );
              this.lastTriggeredTimestamps.set(name, now);
              this.firstDetectedTimestamps.set(name, now);
            }
          }

          // After firing the gesture, reset the state to "waiting" to ensure that the gesture can be detected again after the cooldown period.
          this.gestureStates.set(name, "waiting");
        }
      }
    }
  }

  /**
   * Emits a GestureEvent to all registered listeners for a specific gesture.
   * @param name The name of the detected gesture.
   * @param confidence The confidence level of the detected gesture.
   * @param handMode The hand mode associated with the detected gesture.
   * @param direction The direction of the detected gesture.
   */
  private emitGesture(
    name: string,
    confidence: number,
    handMode: "left" | "right" | "both" | "any",
    direction: Direction,
  ): void {
    const listeners = this.gestureListeners.get(name);
    if (!listeners) return;

    listeners.forEach((callback) => {
      callback({
        name,
        confidence,
        hand: handMode,
        direction,
        timestamp: Date.now(),
      });
    });
  }
}
