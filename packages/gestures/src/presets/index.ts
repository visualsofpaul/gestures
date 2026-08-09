import { Gesture, type GestureBuilder } from "@/core/builder";
import { Finger, State } from "@/core/types";

export const Presets = {
  /**
   * ThumbsUp
   * @description Thumbs up gesture with thumb extended and all other fingers curled.
   * @param name The name of the gesture.
   */
  ThumbsUp: <Name extends string>(name: Name): GestureBuilder<Name> => {
    return Gesture.create(name)
      .where.anyHand()
      .has(Finger.Thumb)
      .inState(State.Extended)
      .has(Finger.Index)
      .inState(State.Curled)
      .has(Finger.Middle)
      .inState(State.Curled)
      .has(Finger.Ring)
      .inState(State.Curled)
      .has(Finger.Pinky)
      .inState(State.Curled)
      .where.determineDirectionFrom(Finger.Thumb);
  },

  /**
   * Pointer
   * @description Index finger extended, all other fingers curled.
   * @param name The name of the gesture.
   */
  Pointer: <Name extends string>(name: Name): GestureBuilder<Name> => {
    return Gesture.create(name)
      .where.anyHand()
      .has(Finger.Index)
      .inState(State.Extended)
      .has(Finger.Thumb)
      .inState(State.Curled)
      .has(Finger.Middle)
      .inState(State.Curled)
      .has(Finger.Ring)
      .inState(State.Curled)
      .has(Finger.Pinky)
      .inState(State.Curled)
      .where.determineDirectionFrom(Finger.Index);
  },

  /**
   * @description Gun pose with thumb and index finger extended, rest curled. To trigger this gesture, the user must curl the index finger.
   * @param name The name of the gesture.
   */
  Gun: <Name extends string>(name: Name): GestureBuilder<Name> => {
    return Gesture.create(name)
      .where.anyHand()
      .has(Finger.Thumb)
      .inState(State.Extended)
      .where.determineDirectionFrom(Finger.Index)
      .thenTriggeredBy()
      .curling([Finger.Index, Finger.Middle])
      .withConfidence(0.75);
  },

  /**
   * PinkyPinch
   * @description Pinch between thumb and pinky finger.
   * @param name The name of the gesture.
   */
  PinkyPinch: <Name extends string>(name: Name): GestureBuilder<Name> => {
    return Gesture.create(name)
      .where.anyHand()
      .pinches(Finger.Thumb, Finger.Pinky);
  },

  /**
   * Fist
   * @description All fingers curled into a fist.
   * @param name The name of the gesture.
   */
  Fist: <Name extends string>(name: Name): GestureBuilder<Name> => {
    return Gesture.create(name).where.anyHand().isClosedInto(State.Curled);
  },

  /**
   * Peace
   * @description Peace gesture with index and middle fingers extended, rest curled. To trigger this gesture, the user must spread the index and middle fingers apart.
   * @param name The name of the gesture.
   */
  Peace: <Name extends string>(name: Name): GestureBuilder<Name> => {
    return Gesture.create(name)
      .where.anyHand()
      .has(Finger.Index)
      .inState(State.Extended)
      .has(Finger.Middle)
      .inState(State.Extended)
      .has(Finger.Thumb)
      .inState(State.Curled)
      .has(Finger.Ring)
      .inState(State.Curled)
      .has(Finger.Pinky)
      .inState(State.Curled)
      .spreads(Finger.Index, Finger.Middle, 0.5)
      .where.determineDirectionFrom(Finger.Index);
  },
};
