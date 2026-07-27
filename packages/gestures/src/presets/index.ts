import { Gesture, type GestureBuilder } from "@/core/builder";
import { Finger, State } from "@/core/types";

export const Presets = {
  /**
   * @name ThumbsUp
   * Thumbs up gesture with thumb extended and all other fingers curled.
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
   * @name Pointer
   * Index finger extended, all other fingers curled.
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
   * @name Gun
   * Gun pose with thumb and index finger extended, rest curled. To trigger this gesture, the user must curl the index finger.
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
   * @name PinkyPinch
   * Pinch between thumb and pinky finger.
   */
  PinkyPinch: <Name extends string>(name: Name): GestureBuilder<Name> => {
    return Gesture.create(name)
      .where.anyHand()
      .pinches(Finger.Thumb, Finger.Pinky);
  },

  /**
   * @name Fist
   * All fingers curled into a fist.
   */
  Fist: <Name extends string>(name: Name): GestureBuilder<Name> => {
    return Gesture.create(name).where.anyHand().isClosedInto(State.Curled);
  },
};
