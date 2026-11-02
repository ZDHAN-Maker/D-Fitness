"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type ExerciseProps = {
  id?: number | string | null;
  name: string;
  primary_muscle?: string | null;
  secondary_muscles?: string[] | null;
  equipment?: string | null;
};

type Props = {
  exercise: ExerciseProps;
  className?: string;
  heightClass?: string;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPt(p1: [number, number], p2: [number, number], t: number): [number, number] {
  return [lerp(p1[0], p2[0], t), lerp(p1[1], p2[1], t)];
}

function armArc(elbow: [number, number], len: number, angleA: number, angleB: number, t: number): [number, number] {
  const ang = lerp(angleA, angleB, t);
  return [elbow[0] + Math.cos(ang) * len, elbow[1] + Math.sin(ang) * len];
}

type PropItem =
  | { type: "floor"; y: number }
  | { type: "wheel"; x: number; y: number; r: number }
  | { type: "pullup_bar"; x: number; y: number }
  | { type: "cable"; x1: number; y1: number; x2: number; y2: number }
  | { type: "bench_decline"; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
  | { type: "bench_flat"; x1: number; x2: number; y: number }
  | { type: "post"; x: number; y1: number; y2: number }
  | { type: "barbell"; x1: number; y1: number; x2: number; y2: number; r?: number }
  | { type: "dumbbell"; x: number; y: number }
  | { type: "band"; x1: number; y1: number; x2: number; y2: number; tension: number }
  | { type: "barbell_side"; x: number; y: number; r?: number }
  | { type: "dumbbell_horiz"; x: number; y: number }
  | { type: "dumbbell_vert"; x: number; y: number }
  | { type: "cable_machine"; pulleyX: number; pulleyY: number; handX: number; handY: number; weightLift: number }
  | { type: "bench_box"; x: number; y: number; w: number; h: number }
  | { type: "incline_bench"; x1: number; y1: number; x2: number; y2: number; x3: number; y3: number }
  | { type: "preacher_bench"; seatX: number; seatY: number; padX1: number; padY1: number; padX2: number; padY2: number }
  | { type: "jump_rope"; handL: [number, number]; handR: [number, number]; peakY: number; behind: boolean }
  | { type: "rowing_machine"; seatX: number; handleX: number; handleY: number; spin: number }
  | { type: "treadmill"; beltOffset: number }
  | { type: "step_block"; x: number; y: number; w: number; h: number }
  | { type: "balance_post"; x: number; y1: number; y2: number }
  | { type: "seated_calf_machine"; seatX: number; seatY: number; kneeX: number; kneeY: number; t: number }
  | { type: "standing_calf_machine"; shoulderX: number; shoulderY: number; t: number }
  | { type: "band_front"; handL: [number, number]; handR: [number, number]; tension: number }
  | { type: "facepull_cable"; pulleyX: number; pulleyY: number; handL: [number, number]; handR: [number, number]; lift: number }
  | { type: "dumbbells_pair"; handL: [number, number]; handR: [number, number] }
  | { type: "reverse_pec_deck_machine"; handL: [number, number]; handR: [number, number]; lift: number }
  | { type: "band_under_feet"; footL: [number, number]; footR: [number, number]; handL: [number, number]; handR: [number, number]; tension: number }
  | { type: "barbell_front"; y: number; w: number }
  | { type: "low_cable_side"; pulleyX: number; pulleyY: number; hand: [number, number]; lift: number }
  | { type: "dumbbell_side"; x: number; y: number }
  | { type: "shoulder_press_machine"; handleY: number; lift: number }
  | { type: "seated_bench_front" }
  | { type: "power_rack_pins"; pinY: number }
  | { type: "low_cable_right"; pulleyX: number; pulleyY: number; hand: [number, number]; lift: number }
  | { type: "dip_bench"; x: number; y: number; w: number; h: number }
  | { type: "flat_bench"; x: number; y: number; w: number }
  | { type: "diamond_marker"; x: number; y: number }
  | { type: "overhead_cable_left"; pulleyX: number; pulleyY: number; hand: [number, number]; lift: number }
  | { type: "short_seat"; x: number; y: number }
  | { type: "ez_bar_side"; x: number; y: number }
  | { type: "parallel_dip_bars"; x: number; y: number }
  | { type: "front_cable_tower"; pulleyX: number; pulleyY: number; hand: [number, number]; lift: number }
  | { type: "high_cable_right"; pulleyX: number; pulleyY: number; handL: [number, number]; handR: [number, number]; isRope: boolean; lift: number };

type KeyframePose = {
  head: [number, number];
  shoulder: [number, number];
  hip: [number, number];
  elbowL: [number, number];
  handL: [number, number];
  elbowR: [number, number];
  handR: [number, number];
  kneeL: [number, number];
  footL: [number, number];
  kneeR: [number, number];
  footR: [number, number];
  intensity: number;
};

function multiPoseLerp(poses: KeyframePose[], cycle: number) {
  const n = poses.length;
  const scaled = (cycle % 1) * n;
  const idx = Math.floor(scaled);
  const frac = scaled - idx;
  const s = frac * frac * (3 - 2 * frac);
  const pA = poses[idx % n] ?? poses[0]!;
  const pB = poses[(idx + 1) % n] ?? poses[0]!;

  return {
    head: lerpPt(pA.head, pB.head, s),
    shoulder: lerpPt(pA.shoulder, pB.shoulder, s),
    hip: lerpPt(pA.hip, pB.hip, s),
    elbowL: lerpPt(pA.elbowL, pB.elbowL, s),
    handL: lerpPt(pA.handL, pB.handL, s),
    elbowR: lerpPt(pA.elbowR, pB.elbowR, s),
    handR: lerpPt(pA.handR, pB.handR, s),
    kneeL: lerpPt(pA.kneeL, pB.kneeL, s),
    footL: lerpPt(pA.footL, pB.footL, s),
    kneeR: lerpPt(pA.kneeR, pB.kneeR, s),
    footR: lerpPt(pA.footR, pB.footR, s),
    intensity: lerp(pA.intensity, pB.intensity, s),
  };
}

type Pose = {
  props: PropItem[];
  head: [number, number];
  shoulder: [number, number];
  hip: [number, number];
  elbowL: [number, number];
  handL: [number, number];
  elbowR: [number, number];
  handR: [number, number];
  kneeL: [number, number];
  footL: [number, number];
  kneeR: [number, number];
  footR: [number, number];
  contraction: number;
  heelL?: [number, number];
  toeL?: [number, number];
  heelR?: [number, number];
  toeR?: [number, number];
  frontView?: boolean;
  nonWorkingLeg?: boolean;
  shL?: [number, number];
  shR?: [number, number];
  view?: string;
};

/**
 * Returns kinematic stickman joint positions (0..200, 0..150 space)
 */
function getPose(exercise: ExerciseProps, t: number, rawTime: number): Pose {
  const alt = Math.sin(rawTime * Math.PI * 2);
  const n = exercise.name.toLowerCase();
  const id = Number(exercise.id) || 0;

  // ==========================================
  // 1. BICEPS CATALOG (9 GERAKAN KHUSUS)
  // ==========================================
  if (id === 43 || n === "banded bicep curl") {
    const head: [number, number] = [92, 30];
    const shoulder: [number, number] = [92, 46];
    const hip: [number, number] = [90, 84];
    const knee: [number, number] = [92, 108];
    const foot: [number, number] = [96, 130];
    const elbow: [number, number] = [93, 68];
    const hand = armArc(elbow, 23, 1.35, -1.15, t);
    return {
      props: [
        { type: "floor", y: 132 },
        { type: "band", x1: foot[0] + 4, y1: foot[1], x2: hand[0], y2: hand[1], tension: t },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: foot,
      kneeR: [86, 108], footR: [88, 130],
      contraction: t,
    };
  }

  if (id === 76 || n === "barbell bicep curl") {
    const head: [number, number] = [92, 30];
    const shoulder: [number, number] = [92, 46];
    const hip: [number, number] = [90, 84];
    const knee: [number, number] = [92, 108];
    const foot: [number, number] = [96, 130];
    const elbow = lerpPt([92, 68], [95, 66], t);
    const hand = armArc(elbow, 23, 1.3, -1.1, t);
    return {
      props: [{ type: "floor", y: 132 }, { type: "barbell_side", x: hand[0], y: hand[1] }],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: foot,
      kneeR: [86, 108], footR: [88, 130],
      contraction: t,
    };
  }

  if (id === 79 || n === "cable bicep curl") {
    const head: [number, number] = [78, 30];
    const shoulder: [number, number] = [78, 46];
    const hip: [number, number] = [76, 84];
    const knee: [number, number] = [78, 108];
    const foot: [number, number] = [82, 130];
    const elbow: [number, number] = [81, 67];
    const hand = armArc(elbow, 23, 1.05, -1.05, t);
    return {
      props: [
        { type: "floor", y: 132 },
        { type: "cable_machine", pulleyX: 152, pulleyY: 124, handX: hand[0], handY: hand[1], weightLift: t },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: foot,
      kneeR: [72, 108], footR: [74, 130],
      contraction: t,
    };
  }

  if (id === 110 || (n === "chin-up" && exercise.primary_muscle === "biceps")) {
    const hand: [number, number] = [100, 24];
    const elbow = lerpPt([108, 44], [112, 54], t);
    const shoulder = lerpPt([100, 62], [100, 32], t);
    const head = lerpPt([100, 48], [100, 18], t);
    const hip = lerpPt([100, 98], [100, 68], t);
    const knee = lerpPt([100, 122], [104, 92], t);
    const foot = lerpPt([100, 142], [96, 112], t);
    return {
      props: [{ type: "pullup_bar", x: 100, y: 22 }],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: foot,
      kneeR: knee, footR: foot,
      contraction: t,
    };
  }

  if (id === 78 || n === "concentration curl") {
    const hip: [number, number] = [72, 92];
    const shoulder: [number, number] = [96, 60];
    const head: [number, number] = [108, 48];
    const knee: [number, number] = [110, 94];
    const foot: [number, number] = [114, 130];
    const elbow: [number, number] = [102, 86];
    const hand = armArc(elbow, 22, 1.45, -1.15, t);
    return {
      props: [
        { type: "floor", y: 132 },
        { type: "bench_box", x: 54, y: 96, w: 34, h: 36 },
        { type: "dumbbell_horiz", x: hand[0], y: hand[1] },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: [88, 76], handR: [104, 90],
      kneeL: knee, footL: foot,
      kneeR: [102, 94], footR: [104, 130],
      contraction: t,
    };
  }

  if (id === 7 || n === "dumbbell curl") {
    const head: [number, number] = [92, 30];
    const shoulder: [number, number] = [92, 46];
    const hip: [number, number] = [90, 84];
    const knee: [number, number] = [92, 108];
    const foot: [number, number] = [96, 130];
    const elbow: [number, number] = [93, 68];
    const hand = armArc(elbow, 23, 1.35, -1.15, t);
    return {
      props: [{ type: "floor", y: 132 }, { type: "dumbbell_horiz", x: hand[0], y: hand[1] }],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: foot,
      kneeR: [86, 108], footR: [88, 130],
      contraction: t,
    };
  }

  if (id === 45 || n === "hammer curl") {
    const head: [number, number] = [92, 30];
    const shoulder: [number, number] = [92, 46];
    const hip: [number, number] = [90, 84];
    const knee: [number, number] = [92, 108];
    const foot: [number, number] = [96, 130];
    const elbow: [number, number] = [93, 68];
    const hand = armArc(elbow, 23, 1.35, -1.05, t);
    return {
      props: [{ type: "floor", y: 132 }, { type: "dumbbell_vert", x: hand[0], y: hand[1] }],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: foot,
      kneeR: [86, 108], footR: [88, 130],
      contraction: t,
    };
  }

  if (id === 77 || n === "incline dumbbell curl") {
    const hip: [number, number] = [98, 94];
    const shoulder: [number, number] = [72, 62];
    const head: [number, number] = [64, 48];
    const knee: [number, number] = [128, 94];
    const foot: [number, number] = [136, 130];
    const elbow: [number, number] = [72, 86];
    const hand = armArc(elbow, 23, 1.5, -0.85, t);
    return {
      props: [
        { type: "floor", y: 132 },
        { type: "incline_bench", x1: 52, y1: 48, x2: 100, y2: 98, x3: 126, y3: 98 },
        { type: "dumbbell_horiz", x: hand[0], y: hand[1] },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: foot,
      kneeR: knee, footR: foot,
      contraction: t,
    };
  }

  if (id === 46 || n === "preacher curl") {
    const hip: [number, number] = [68, 96];
    const shoulder: [number, number] = [80, 58];
    const head: [number, number] = [82, 42];
    const knee: [number, number] = [98, 102];
    const foot: [number, number] = [102, 130];
    const elbow: [number, number] = [104, 72];
    const hand = armArc(elbow, 23, 0.55, -1.45, t);
    return {
      props: [
        { type: "floor", y: 132 },
        { type: "preacher_bench", seatX: 54, seatY: 100, padX1: 88, padY1: 58, padX2: 114, padY2: 80 },
        { type: "barbell_side", x: hand[0], y: hand[1] },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: foot,
      kneeR: knee, footR: foot,
      contraction: t,
    };
  }

  // ==========================================
  // 2. ABS CATALOG (15 GERAKAN KHUSUS)
  // ==========================================
  if (id === 83 || n.includes("ab wheel")) {
    const wheelX = lerp(78, 152, t);
    const hip = lerpPt([62, 85], [100, 102], t);
    const shoulder = lerpPt([80, 68], [138, 92], t);
    const head = lerpPt([90, 58], [150, 86], t);
    const elbow = lerpPt([79, 95], [145, 107], t);
    return {
      props: [{ type: "floor", y: 126 }, { type: "wheel", x: wheelX, y: 118, r: 7 }],
      head, shoulder, hip,
      elbowL: elbow, handL: [wheelX, 118],
      elbowR: elbow, handR: [wheelX, 118],
      kneeL: [48, 123], footL: [30, 124],
      kneeR: [48, 123], footR: [30, 124],
      contraction: t,
    };
  }

  if (id === 64 || n.includes("bicycle crunch")) {
    const s = (alt + 1) / 2;
    const hip: [number, number] = [95, 118];
    const shoulder: [number, number] = [62, 100 - Math.abs(alt) * 8];
    const head: [number, number] = [50, 88 - Math.abs(alt) * 8];
    const kneeL = lerpPt([115, 78], [135, 105], s);
    const footL = lerpPt([135, 85], [170, 110], s);
    const kneeR = lerpPt([135, 105], [115, 78], s);
    const footR = lerpPt([170, 110], [135, 85], s);
    const elbowL = lerpPt([78, 82], [45, 92], s);
    const elbowR = lerpPt([45, 92], [78, 82], s);
    return {
      props: [{ type: "floor", y: 126 }],
      head, shoulder, hip,
      elbowL, handL: head,
      elbowR, handR: head,
      kneeL, footL, kneeR, footR,
      contraction: 0.4 + 0.6 * Math.abs(alt),
    };
  }

  if (id === 82 || n.includes("cable rope crunch")) {
    const hip = lerpPt([110, 92], [116, 98], t);
    const shoulder = lerpPt([105, 52], [82, 82], t);
    const head = lerpPt([102, 36], [72, 92], t);
    const hand = lerpPt([95, 42], [68, 92], t);
    const elbow = lerpPt([92, 60], [72, 98], t);
    return {
      props: [
        { type: "floor", y: 126 },
        { type: "cable", x1: 45, y1: 18, x2: hand[0], y2: hand[1] },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: [108, 123], footL: [132, 124],
      kneeR: [108, 123], footR: [132, 124],
      contraction: t,
    };
  }

  if (id === 60 || n.includes("deadbug")) {
    const hip: [number, number] = [105, 118];
    const shoulder: [number, number] = [65, 118];
    const head: [number, number] = [50, 114];
    const handL = lerpPt([65, 75], [32, 108], t);
    const elbowL = lerpPt([65, 95], [48, 112], t);
    const kneeR = lerpPt([105, 82], [138, 106], t);
    const footR = lerpPt([132, 82], [172, 112], t);
    return {
      props: [{ type: "floor", y: 125 }],
      head, shoulder, hip,
      elbowL, handL, elbowR: [67, 96], handR: [68, 76],
      kneeL: [105, 82], footL: [132, 82],
      kneeR, footR,
      contraction: t,
    };
  }

  if (id === 85 || n.includes("decline") || n.includes("sit-up")) {
    const hip: [number, number] = [112, 102];
    const shoulder = lerpPt([68, 114], [106, 64], t);
    const head = lerpPt([54, 118], [105, 48], t);
    const hand = lerpPt([75, 104], [114, 68], t);
    const elbow = lerpPt([72, 118], [102, 78], t);
    return {
      props: [
        { type: "bench_decline", x1: 48, y1: 122, x2: 142, y2: 82, x3: 162, y3: 100 },
        { type: "dumbbell", x: hand[0], y: hand[1] },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: [142, 78], footL: [158, 98],
      kneeR: [142, 78], footR: [158, 98],
      contraction: t,
    };
  }

  if (id === 86 || n.includes("dragon flag")) {
    const shoulder: [number, number] = [68, 116];
    const head: [number, number] = [54, 114];
    const angle = lerp(-0.18, -1.08, t);
    const hip: [number, number] = [shoulder[0] + Math.cos(angle) * 42, shoulder[1] + Math.sin(angle) * 42];
    const knee: [number, number] = [shoulder[0] + Math.cos(angle) * 76, shoulder[1] + Math.sin(angle) * 76];
    const foot: [number, number] = [shoulder[0] + Math.cos(angle) * 108, shoulder[1] + Math.sin(angle) * 108];
    return {
      props: [
        { type: "bench_flat", x1: 35, x2: 115, y: 122 },
        { type: "post", x: 38, y1: 95, y2: 122 },
      ],
      head, shoulder, hip,
      elbowL: [46, 110], handL: [38, 102],
      elbowR: [46, 110], handR: [38, 102],
      kneeL: knee, footL: foot,
      kneeR: knee, footR: foot,
      contraction: 0.4 + 0.6 * t,
    };
  }

  if (id === 20 || n.includes("hanging knee raise")) {
    const hip = lerpPt([100, 86], [104, 82], t);
    const knee = lerpPt([100, 114], [128, 74], t);
    const foot = lerpPt([100, 140], [116, 102], t);
    return {
      props: [{ type: "pullup_bar", x: 100, y: 18 }],
      head: [100, 38], shoulder: [100, 50], hip,
      elbowL: [100, 36], handL: [100, 20],
      elbowR: [100, 36], handR: [100, 20],
      kneeL: knee, footL: foot,
      kneeR: knee, footR: foot,
      contraction: t,
    };
  }

  if (id === 84 || n.includes("hanging straight leg") || n.includes("toes to bar")) {
    const hip = lerpPt([96, 86], [98, 80], t);
    const knee = lerpPt([96, 114], [126, 68], t);
    const foot = lerpPt([96, 140], [146, 32], t);
    return {
      props: [{ type: "pullup_bar", x: 96, y: 18 }],
      head: [96, 38], shoulder: [96, 50], hip,
      elbowL: [96, 36], handL: [96, 20],
      elbowR: [96, 36], handR: [96, 20],
      kneeL: knee, footL: foot,
      kneeR: knee, footR: foot,
      contraction: t,
    };
  }

  if (id === 61 || n.includes("leg raise") || n.includes("reverse crunch")) {
    const hip: [number, number] = [102, 118];
    const angle = lerp(-0.1, -1.52, t);
    const knee: [number, number] = [hip[0] + Math.cos(angle) * 32, hip[1] + Math.sin(angle) * 32];
    const foot: [number, number] = [hip[0] + Math.cos(angle) * 64, hip[1] + Math.sin(angle) * 64];
    return {
      props: [{ type: "floor", y: 125 }],
      head: [48, 115], shoulder: [62, 118], hip,
      elbowL: [80, 120], handL: [98, 121],
      elbowR: [80, 120], handR: [98, 121],
      kneeL: knee, footL: foot,
      kneeR: knee, footR: foot,
      contraction: t,
    };
  }

  if (id === 19 || n.includes("plank")) {
    const br = Math.sin(rawTime * Math.PI * 4) * 1.5;
    return {
      props: [{ type: "floor", y: 125 }],
      head: [52, 92 + br * 0.4], shoulder: [68, 96 + br * 0.4], hip: [112, 102 + br],
      elbowL: [68, 122], handL: [50, 122],
      elbowR: [68, 122], handR: [50, 122],
      kneeL: [138, 112], footL: [162, 122],
      kneeR: [138, 112], footR: [162, 122],
      contraction: 0.75 + 0.25 * t,
    };
  }

  if (id === 63 || n.includes("mountain climber")) {
    const s = (alt + 1) / 2;
    const kneeL = lerpPt([84, 104], [136, 108], s);
    const footL = lerpPt([102, 118], [164, 122], s);
    const kneeR = lerpPt([136, 108], [84, 104], s);
    const footR = lerpPt([164, 122], [102, 118], s);
    return {
      props: [{ type: "floor", y: 125 }],
      head: [50, 76], shoulder: [65, 82], hip: [110, 90],
      elbowL: [63, 102], handL: [62, 122],
      elbowR: [63, 102], handR: [62, 122],
      kneeL, footL, kneeR, footR,
      contraction: 0.5 + 0.5 * Math.abs(alt),
    };
  }

  // ==========================================
  // 3. CARDIO CATALOG (6 GERAKAN KHUSUS)
  // ==========================================
  if (id === 67 || n.includes("burpee")) {
    const cycle = (rawTime * 0.65) % 1;
    const keyframes: KeyframePose[] = [
      {
        head: [94, 72], shoulder: [90, 86], hip: [72, 108],
        elbowL: [94, 106], handL: [98, 128],
        elbowR: [92, 106], handR: [96, 128],
        kneeL: [94, 108], footL: [84, 128],
        kneeR: [90, 108], footR: [80, 128],
        intensity: 0.7,
      },
      {
        head: [118, 96], shoulder: [104, 102], hip: [68, 108],
        elbowL: [96, 114], handL: [102, 128],
        elbowR: [94, 114], handR: [100, 128],
        kneeL: [46, 118], footL: [26, 128],
        kneeR: [44, 118], footR: [24, 128],
        intensity: 1.0,
      },
      {
        head: [98, 68], shoulder: [92, 82], hip: [74, 106],
        elbowL: [94, 102], handL: [100, 122],
        elbowR: [92, 102], handR: [98, 122],
        kneeL: [96, 106], footL: [86, 128],
        kneeR: [92, 106], footR: [82, 128],
        intensity: 0.75,
      },
      {
        head: [92, 22], shoulder: [92, 36], hip: [92, 70],
        elbowL: [88, 18], handL: [86, 6],
        elbowR: [96, 18], handR: [98, 6],
        kneeL: [90, 92], footL: [88, 112],
        kneeR: [94, 92], footR: [96, 112],
        intensity: 1.0,
      },
    ];
    const pose = multiPoseLerp(keyframes, cycle);
    return {
      props: [{ type: "floor", y: 130 }],
      ...pose,
      frontView: false,
      contraction: pose.intensity,
    };
  }

  if (id === 65 || n.includes("high knee")) {
    const s = Math.sin(rawTime * Math.PI * 2.6);
    const nRatio = (s + 1) / 2;
    const bounce = Math.abs(Math.cos(rawTime * Math.PI * 2.6)) * 5;

    const head: [number, number] = [96, 26 - bounce];
    const shoulder: [number, number] = [94, 42 - bounce];
    const hip: [number, number] = [92, 78 - bounce];

    const kneeL = lerpPt([122, 66 - bounce], [90, 104 - bounce], nRatio);
    const footL = lerpPt([116, 96 - bounce], [88, 128 - bounce * 0.4], nRatio);
    const kneeR = lerpPt([90, 104 - bounce], [122, 66 - bounce], nRatio);
    const footR = lerpPt([88, 128 - bounce * 0.4], [116, 96 - bounce], nRatio);

    const elbowL = lerpPt([78, 58 - bounce], [108, 56 - bounce], nRatio);
    const handL = lerpPt([68, 48 - bounce], [118, 40 - bounce], nRatio);
    const elbowR = lerpPt([108, 56 - bounce], [78, 58 - bounce], nRatio);
    const handR = lerpPt([118, 40 - bounce], [68, 48 - bounce], nRatio);

    return {
      props: [{ type: "floor", y: 130 }],
      head, shoulder, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      frontView: false,
      contraction: 0.65 + 0.35 * Math.abs(s),
    };
  }

  if (id === 23 || n.includes("jump rope") || n.includes("skipping")) {
    const angle = (rawTime * Math.PI * 2.8) % (Math.PI * 2);
    const jumpFactor = Math.max(0, -Math.cos(angle));
    const lift = jumpFactor * 14;

    const head: [number, number] = [100, 32 - lift];
    const shoulder: [number, number] = [100, 48 - lift];
    const hip: [number, number] = [100, 82 - lift];

    const wristCircle = Math.sin(angle) * 3;
    const elbowL: [number, number] = [82, 66 - lift];
    const handL: [number, number] = [74, 74 - lift + wristCircle];
    const elbowR: [number, number] = [118, 66 - lift];
    const handR: [number, number] = [126, 74 - lift + wristCircle];

    const kneeL: [number, number] = [94, 104 - lift];
    const footL: [number, number] = [94, 128 - lift * 1.1];
    const kneeR: [number, number] = [106, 104 - lift];
    const footR: [number, number] = [106, 128 - lift * 1.1];

    const ropePeakY = 70 + Math.cos(angle) * 66 - lift * 0.4;
    const ropeBehind = Math.sin(angle) < 0;

    return {
      props: [
        { type: "floor", y: 132 },
        { type: "jump_rope", handL, handR, peakY: ropePeakY, behind: ropeBehind },
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      frontView: true,
      contraction: 0.55 + 0.45 * jumpFactor,
    };
  }

  if (id === 66 || n.includes("jumping jack")) {
    const tJack = (1 - Math.cos(rawTime * Math.PI * 2.4)) / 2;
    const bounce = Math.sin(tJack * Math.PI) * 7;

    const head: [number, number] = [100, 32 - bounce];
    const shoulder: [number, number] = [100, 48 - bounce];
    const hip: [number, number] = [100, 82 - bounce];

    const elbowL = lerpPt([84, 68 - bounce], [76, 30 - bounce], tJack);
    const handL = lerpPt([80, 86 - bounce], [94, 12 - bounce], tJack);
    const elbowR = lerpPt([116, 68 - bounce], [124, 30 - bounce], tJack);
    const handR = lerpPt([120, 86 - bounce], [106, 12 - bounce], tJack);

    const kneeL = lerpPt([95, 106 - bounce], [80, 104 - bounce], tJack);
    const footL = lerpPt([95, 128 - bounce * 0.5], [66, 128 - bounce * 0.3], tJack);
    const kneeR = lerpPt([105, 106 - bounce], [120, 104 - bounce], tJack);
    const footR = lerpPt([105, 128 - bounce * 0.5], [134, 128 - bounce * 0.3], tJack);

    return {
      props: [{ type: "floor", y: 130 }],
      head, shoulder, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      frontView: true,
      contraction: 0.45 + 0.55 * tJack,
    };
  }

  if (id === 22 || n.includes("rowing machine") || n.includes("rower")) {
    const tRow = (1 - Math.cos(rawTime * Math.PI * 1.6)) / 2;
    const foot: [number, number] = [64, 118];
    const hip = lerpPt([88, 104], [138, 104], tRow);
    const knee = lerpPt([76, 80], [102, 106], tRow);
    const shoulder = lerpPt([76, 66], [150, 68], tRow);
    const head = lerpPt([74, 50], [154, 52], tRow);
    const hand = lerpPt([56, 76], [134, 82], tRow);
    const elbow = lerpPt([66, 72], [156, 80], tRow);

    return {
      props: [
        { type: "floor", y: 132 },
        { type: "rowing_machine", seatX: hip[0], handleX: hand[0], handleY: hand[1], spin: rawTime * 10 },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: foot,
      kneeR: [knee[0] - 2, knee[1] - 2], footR: foot,
      frontView: false,
      contraction: 0.4 + 0.6 * tRow,
    };
  }

  if (id === 21 || n.includes("treadmill") || (exercise.primary_muscle === "cardio" && !n.includes("burpee"))) {
    const s = Math.sin(rawTime * Math.PI * 2.6);
    const cVal = Math.cos(rawTime * Math.PI * 2.6);
    const nRatio = (s + 1) / 2;
    const bounce = Math.abs(cVal) * 4.5;

    const hip: [number, number] = [94, 78 - bounce];
    const shoulder: [number, number] = [100, 44 - bounce];
    const head: [number, number] = [104, 28 - bounce];

    const kneeL = lerpPt([116, 94 - bounce], [78, 96 - bounce], nRatio);
    const footL = lerpPt([126, 116 - Math.max(0, cVal) * 8], [62, 114 - Math.max(0, -cVal) * 12], nRatio);
    const kneeR = lerpPt([78, 96 - bounce], [116, 94 - bounce], nRatio);
    const footR = lerpPt([62, 114 - Math.max(0, -cVal) * 12], [126, 116 - Math.max(0, cVal) * 8], nRatio);

    const elbowL = lerpPt([84, 62 - bounce], [112, 60 - bounce], nRatio);
    const handL = lerpPt([96, 52 - bounce], [124, 48 - bounce], nRatio);
    const elbowR = lerpPt([112, 60 - bounce], [84, 62 - bounce], nRatio);
    const handR = lerpPt([124, 48 - bounce], [96, 52 - bounce], nRatio);

    return {
      props: [
        { type: "floor", y: 132 },
        { type: "treadmill", beltOffset: (rawTime * 60) % 18 },
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      frontView: false,
      contraction: 0.75 + 0.25 * Math.abs(s),
    };
  }

  // ==========================================
  // 4. CALVES / BETIS CATALOG (3 GERAKAN KHUSUS)
  // ==========================================
  if (id === 56 || n.includes("seated calf raise")) {
    const hip: [number, number] = [62, 86];
    const shoulder: [number, number] = [60, 48];
    const head: [number, number] = [60, 32];
    const toe: [number, number] = [126, 120];
    const heel = lerpPt([111, 127], [115, 106], t);
    const knee = lerpPt([111, 88], [114, 68], t);
    const elbow: [number, number] = [74, 70];
    const hand = lerpPt([98, 76], [100, 64], t);

    return {
      props: [
        { type: "floor", y: 134 },
        { type: "step_block", x: 118, y: 120, w: 22, h: 14 },
        { type: "seated_calf_machine", seatX: 46, seatY: 90, kneeX: knee[0], kneeY: knee[1], t },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: toe,
      kneeR: [knee[0] - 3, knee[1] - 2], footR: [toe[0] - 2, toe[1] - 1],
      heelL: heel, toeL: toe,
      heelR: [heel[0] - 3, heel[1] - 1], toeR: [toe[0] - 2, toe[1] - 1],
      nonWorkingLeg: false,
      contraction: t,
    };
  }

  if (id === 50 || n.includes("single-leg calf raise")) {
    const lift = lerp(4, -15, t);
    const toe: [number, number] = [104, 118];
    const heel = lerpPt([89, 126], [93, 105], t);
    const knee: [number, number] = [95, 84 + lift];
    const hip: [number, number] = [94, 56 + lift];
    const shoulder: [number, number] = [95, 28 + lift];
    const head: [number, number] = [95, 15 + lift];

    const elbow: [number, number] = [110, 42 + lift * 0.7];
    const hand: [number, number] = [132, 46 + lift * 0.3];

    const kneeIdle: [number, number] = [91, 86 + lift];
    const heelIdle: [number, number] = [74, 96 + lift];
    const toeIdle: [number, number] = [72, 106 + lift];

    return {
      props: [
        { type: "floor", y: 134 },
        { type: "step_block", x: 98, y: 118, w: 26, h: 16 },
        { type: "balance_post", x: 136, y1: 18, y2: 134 },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: toe,
      kneeR: kneeIdle, footR: toeIdle,
      heelL: heel, toeL: toe,
      heelR: heelIdle, toeR: toeIdle,
      nonWorkingLeg: true,
      contraction: t,
    };
  }

  if (id === 117 || n.includes("standing machine calf") || exercise.primary_muscle === "calves") {
    const lift = lerp(4, -15, t);
    const toe: [number, number] = [106, 118];
    const heel = lerpPt([91, 126], [95, 105], t);
    const knee: [number, number] = [97, 84 + lift];
    const hip: [number, number] = [95, 56 + lift];
    const shoulder: [number, number] = [96, 30 + lift];
    const head: [number, number] = [96, 17 + lift];

    const elbow: [number, number] = [84, 42 + lift];
    const hand: [number, number] = [98, 28 + lift];

    return {
      props: [
        { type: "floor", y: 134 },
        { type: "step_block", x: 100, y: 118, w: 24, h: 16 },
        { type: "standing_calf_machine", shoulderX: shoulder[0], shoulderY: shoulder[1], t },
      ],
      head, shoulder, hip,
      elbowL: elbow, handL: hand,
      elbowR: elbow, handR: hand,
      kneeL: knee, footL: toe,
      kneeR: [knee[0] - 4, knee[1] - 1], footR: [toe[0] - 3, toe[1] - 1],
      heelL: heel, toeL: toe,
      heelR: [heel[0] - 4, heel[1] - 1], toeR: [toe[0] - 3, toe[1] - 1],
      nonWorkingLeg: false,
      contraction: t,
    };
  }

  // ==========================================
  // 5. CHEST & PUSH-UP / BENCH PRESS ARCHETYPE
  // ==========================================
  if (
    n.includes("bench press") ||
    n.includes("push-up") ||
    n.includes("chest press") ||
    n.includes("floor press") ||
    n.includes("dips")
  ) {
    const isPushup = n.includes("push-up");
    if (isPushup) {
      const yShift = lerp(0, 24, 1 - t);
      const head: [number, number] = [48, 76 + yShift];
      const shoulder: [number, number] = [64, 82 + yShift];
      const hip: [number, number] = [112, 92 + yShift];
      const elbow: [number, number] = [68, 98 + yShift * 0.4];
      const hand: [number, number] = [64, 122];
      return {
        props: [{ type: "floor", y: 124 }],
        head, shoulder, hip,
        elbowL: elbow, handL: hand,
        elbowR: elbow, handR: hand,
        kneeL: [142, 108 + yShift * 0.5], footL: [168, 122],
        kneeR: [142, 108 + yShift * 0.5], footR: [168, 122],
        contraction: t,
      };
    } else {
      const barY = lerp(96, 60, t);
      const shoulder: [number, number] = [80, 112];
      const head: [number, number] = [58, 112];
      const hip: [number, number] = [120, 112];
      const hand: [number, number] = [80, barY];
      const elbow = lerpPt([92, 116], [82, 88], t);
      return {
        props: [
          { type: "floor", y: 130 },
          { type: "bench_flat", x1: 45, x2: 135, y: 114 },
          { type: "barbell", x1: 65, y1: barY, x2: 95, y2: barY, r: 8 },
        ],
        head, shoulder, hip,
        elbowL: elbow, handL: hand,
        elbowR: elbow, handR: hand,
        kneeL: [140, 96], footL: [156, 128],
        kneeR: [140, 96], footR: [156, 128],
        contraction: t,
      };
    }
  }

  // ==========================================
  // 4. SQUAT / LOWER BODY ARCHETYPE
  // ==========================================
  if (
    n.includes("squat") ||
    n.includes("leg press") ||
    n.includes("lunge") ||
    exercise.primary_muscle === "quadriceps" ||
    exercise.primary_muscle === "glutes"
  ) {
    const hip = lerpPt([92, 106], [100, 72], t);
    const shoulder = lerpPt([94, 76], [100, 42], t);
    const head: [number, number] = [shoulder[0], shoulder[1] - 14];
    const knee = lerpPt([122, 108], [104, 96], t);
    const foot: [number, number] = [102, 126];
    const barY = shoulder[1];
    return {
      props: [
        { type: "floor", y: 128 },
        { type: "barbell", x1: 82, y1: barY, x2: 118, y2: barY, r: 7 },
      ],
      head, shoulder, hip,
      elbowL: [shoulder[0] - 8, shoulder[1] + 10], handL: [shoulder[0] - 4, barY],
      elbowR: [shoulder[0] + 8, shoulder[1] + 10], handR: [shoulder[0] + 4, barY],
      kneeL: knee, footL: foot,
      kneeR: knee, footR: foot,
      contraction: t,
    };
  }

  // ==========================================
  // 5. DEADLIFT / HINGE ARCHETYPE
  // ==========================================
  if (
    n.includes("deadlift") ||
    n.includes("rack pull") ||
    n.includes("extension") ||
    exercise.primary_muscle === "hamstrings"
  ) {
    const barY = lerp(120, 84, t);
    const hip = lerpPt([68, 88], [94, 82], t);
    const shoulder = lerpPt([116, 78], [96, 44], t);
    const head: [number, number] = [shoulder[0] + 8, shoulder[1] - 12];
    const knee = lerpPt([98, 104], [96, 104], t);
    const foot: [number, number] = [96, 126];
    return {
      props: [
        { type: "floor", y: 128 },
        { type: "barbell", x1: 96, y1: barY, x2: 120, y2: barY, r: 9 },
      ],
      head, shoulder, hip,
      elbowL: [shoulder[0], lerp(100, 64, t)], handL: [106, barY],
      elbowR: [shoulder[0], lerp(100, 64, t)], handR: [106, barY],
      kneeL: knee, footL: foot,
      kneeR: knee, footR: foot,
      contraction: t,
    };
  }

  // ==========================================
  // 6. PULL-UP / ROW / LATS ARCHETYPE
  // ==========================================
  if (
    n.includes("pull-up") ||
    n.includes("chin-up") ||
    n.includes("pulldown") ||
    n.includes("row") ||
    exercise.primary_muscle === "lats"
  ) {
    const isRow = n.includes("row");
    if (isRow) {
      const handY = lerp(118, 88, t);
      const shoulder: [number, number] = [105, 68];
      const hip: [number, number] = [76, 88];
      const elbow = lerpPt([105, 102], [82, 62], t);
      return {
        props: [
          { type: "floor", y: 128 },
          { type: "barbell", x1: 85, y1: handY, x2: 115, y2: handY, r: 7 },
        ],
        head: [118, 56], shoulder, hip,
        elbowL: elbow, handL: [98, handY],
        elbowR: elbow, handR: [98, handY],
        kneeL: [88, 106], footL: [86, 126],
        kneeR: [88, 106], footR: [86, 126],
        contraction: t,
      };
    } else {
      const yRise = lerp(0, 32, t);
      const shoulder: [number, number] = [100, 78 - yRise];
      const head: [number, number] = [100, 64 - yRise];
      const hip: [number, number] = [100, 114 - yRise];
      const elbow = lerpPt([100, 52], [86, 76 - yRise], t);
      return {
        props: [{ type: "pullup_bar", x: 100, y: 22 }],
        head, shoulder, hip,
        elbowL: elbow, handL: [100, 24],
        elbowR: elbow, handR: [100, 24],
        kneeL: [98, 136 - yRise], footL: [104, 150 - yRise],
        kneeR: [98, 136 - yRise], footR: [104, 150 - yRise],
        contraction: t,
      };
    }
  }

  // ==========================================
  // 7. REAR DELTS CATALOG (4 GERAKAN KHUSUS)
  // ==========================================
  if (id === 32 || n === "band pull-apart") {
    const head: [number, number] = [110, 30];
    const shoulder: [number, number] = [110, 48];
    const shL: [number, number] = [96, 50];
    const shR: [number, number] = [124, 50];
    const hip: [number, number] = [110, 92];
    const kneeL: [number, number] = [100, 114]; const footL: [number, number] = [98, 134];
    const kneeR: [number, number] = [120, 114]; const footR: [number, number] = [122, 134];

    const elbowL = lerpPt([88, 54], [70, 50], t);
    const handL = lerpPt([94, 56], [42, 48], t);
    const elbowR = lerpPt([132, 54], [150, 50], t);
    const handR = lerpPt([126, 56], [178, 48], t);

    return {
      view: "front",
      props: [
        { type: "floor", y: 136 },
        { type: "band_front", handL, handR, tension: t }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 42 || n === "cable face pull" || n.includes("face pull")) {
    const head = lerpPt([80, 36], [74, 36], t);
    const shoulder = lerpPt([80, 52], [74, 52], t);
    const hip: [number, number] = [78, 90];
    const kneeL: [number, number] = [84, 112]; const footL: [number, number] = [88, 134];
    const kneeR: [number, number] = [72, 112]; const footR: [number, number] = [68, 134];

    const elbowL = lerpPt([104, 48], [54, 48], t);
    const handL = lerpPt([128, 42], [68, 32], t);
    const elbowR = lerpPt([104, 52], [58, 54], t);
    const handR = lerpPt([128, 44], [72, 38], t);

    return {
      view: "side_facepull",
      props: [
        { type: "floor", y: 136 },
        { type: "facepull_cable", pulleyX: 168, pulleyY: 34, handL, handR, lift: t }
      ],
      head, shoulder, shL: shoulder, shR: shoulder, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 107 || n.includes("rear delt fly")) {
    const head: [number, number] = [110, 56];
    const shoulder: [number, number] = [110, 64];
    const shL: [number, number] = [96, 64];
    const shR: [number, number] = [124, 64];
    const hip: [number, number] = [110, 92];
    const kneeL: [number, number] = [98, 112]; const footL: [number, number] = [96, 134];
    const kneeR: [number, number] = [122, 112]; const footR: [number, number] = [124, 134];

    const elbowL = lerpPt([92, 86], [68, 62], t);
    const handL = lerpPt([98, 108], [46, 56], t);
    const elbowR = lerpPt([128, 86], [152, 62], t);
    const handR = lerpPt([122, 108], [174, 56], t);

    return {
      view: "front_bent",
      props: [
        { type: "floor", y: 136 },
        { type: "dumbbells_pair", handL, handR }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 39 || n.includes("reverse pec deck") || exercise.primary_muscle === "rear delts") {
    const head: [number, number] = [110, 32];
    const shoulder: [number, number] = [110, 50];
    const shL: [number, number] = [96, 52];
    const shR: [number, number] = [124, 52];
    const hip: [number, number] = [110, 94];
    const kneeL: [number, number] = [94, 108]; const footL: [number, number] = [94, 134];
    const kneeR: [number, number] = [126, 108]; const footR: [number, number] = [126, 134];

    const elbowL = lerpPt([92, 58], [68, 52], t);
    const handL = lerpPt([102, 58], [44, 50], t);
    const elbowR = lerpPt([128, 58], [152, 52], t);
    const handR = lerpPt([118, 58], [176, 50], t);

    return {
      view: "front_machine",
      props: [
        { type: "floor", y: 136 },
        { type: "reverse_pec_deck_machine", handL, handR, lift: t }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  // ==========================================
  // 8. SHOULDERS & TRAPS CATALOG (15 GERAKAN KHUSUS)
  // ==========================================
  if (id === 103 || n.includes("arnold press")) {
    const head: [number, number] = [110, 40];
    const shoulder: [number, number] = [110, 56];
    const shL: [number, number] = [94, 58];
    const shR: [number, number] = [126, 58];
    const hip: [number, number] = [110, 96];
    const kneeL: [number, number] = [98, 116]; const footL: [number, number] = [96, 136];
    const kneeR: [number, number] = [122, 116]; const footR: [number, number] = [124, 136];

    let elbowL: [number, number], handL: [number, number], elbowR: [number, number], handR: [number, number];
    if (t < 0.45) {
      const s = t / 0.45;
      elbowL = lerpPt([100, 76], [72, 62], s);
      handL = lerpPt([102, 54], [74, 42], s);
      elbowR = lerpPt([120, 76], [148, 62], s);
      handR = lerpPt([118, 54], [146, 42], s);
    } else {
      const s = (t - 0.45) / 0.55;
      elbowL = lerpPt([72, 62], [86, 36], s);
      handL = lerpPt([74, 42], [92, 14], s);
      elbowR = lerpPt([148, 62], [134, 36], s);
      handR = lerpPt([146, 42], [128, 14], s);
    }

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "dumbbells_pair", handL, handR }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 36 || n.includes("banded lateral raise")) {
    const head: [number, number] = [110, 34];
    const shoulder: [number, number] = [110, 50];
    const shL: [number, number] = [95, 52];
    const shR: [number, number] = [125, 52];
    const hip: [number, number] = [110, 92];
    const kneeL: [number, number] = [102, 114]; const footL: [number, number] = [102, 136];
    const kneeR: [number, number] = [118, 114]; const footR: [number, number] = [118, 136];

    const elbowL = lerpPt([88, 74], [70, 52], t);
    const handL = lerpPt([86, 94], [46, 50], t);
    const elbowR = lerpPt([132, 74], [150, 52], t);
    const handR = lerpPt([134, 94], [174, 50], t);

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "band_under_feet", footL, footR, handL, handR, tension: t }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 41 || n.includes("barbell overhead press") || n.includes("military press")) {
    const head: [number, number] = [110, 42];
    const shoulder: [number, number] = [110, 58];
    const shL: [number, number] = [94, 60];
    const shR: [number, number] = [126, 60];
    const hip: [number, number] = [110, 96];
    const kneeL: [number, number] = [98, 116]; const footL: [number, number] = [96, 136];
    const kneeR: [number, number] = [122, 116]; const footR: [number, number] = [124, 136];

    const barY = lerp(54, 14, t);
    const handL: [number, number] = [78, barY];
    const handR: [number, number] = [142, barY];
    const elbowL = lerpPt([80, 76], [84, 36], t);
    const elbowR = lerpPt([140, 76], [136, 36], t);

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "barbell_front", y: barY, w: 68 }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 40 || n.includes("cable lateral raise")) {
    const head: [number, number] = [106, 34];
    const shoulder: [number, number] = [106, 50];
    const shL: [number, number] = [92, 52];
    const shR: [number, number] = [120, 52];
    const hip: [number, number] = [106, 92];
    const kneeL: [number, number] = [96, 114]; const footL: [number, number] = [94, 136];
    const kneeR: [number, number] = [116, 114]; const footR: [number, number] = [118, 136];

    const elbowL = lerpPt([100, 76], [68, 52], t);
    const handL = lerpPt([112, 92], [44, 48], t);
    const elbowR: [number, number] = [138, 66];
    const handR: [number, number] = [162, 68];

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "low_cable_side", pulleyX: 164, pulleyY: 130, hand: handL, lift: t }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 38 || n.includes("dumbbell front raise") || n.includes("front raise")) {
    const head: [number, number] = [88, 34];
    const shoulder: [number, number] = [88, 50];
    const hip: [number, number] = [86, 90];
    const kneeL: [number, number] = [90, 112]; const footL: [number, number] = [94, 136];
    const kneeR: [number, number] = [82, 112]; const footR: [number, number] = [84, 136];

    const angle = lerp(1.35, -0.05, t);
    const elbowL: [number, number] = [shoulder[0] + Math.cos(angle) * 20, shoulder[1] + Math.sin(angle) * 20];
    const handL: [number, number] = [shoulder[0] + Math.cos(angle) * 40, shoulder[1] + Math.sin(angle) * 40];

    return {
      view: "side",
      props: [
        { type: "floor", y: 138 },
        { type: "dumbbell_side", x: handL[0], y: handL[1] }
      ],
      head, shoulder, shL: shoulder, shR: shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 5 || (n.includes("lateral raise") && !n.includes("band") && !n.includes("cable"))) {
    const head: [number, number] = [110, 34];
    const shoulder: [number, number] = [110, 50];
    const shL: [number, number] = [95, 52];
    const shR: [number, number] = [125, 52];
    const hip: [number, number] = [110, 92];
    const kneeL: [number, number] = [98, 114]; const footL: [number, number] = [96, 136];
    const kneeR: [number, number] = [122, 114]; const footR: [number, number] = [124, 136];

    const elbowL = lerpPt([88, 74], [70, 52], t);
    const handL = lerpPt([86, 94], [44, 50], t);
    const elbowR = lerpPt([132, 74], [150, 52], t);
    const handR = lerpPt([134, 94], [176, 50], t);

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "dumbbells_pair", handL, handR }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 105 || n.includes("machine shoulder press")) {
    const head: [number, number] = [110, 44];
    const shoulder: [number, number] = [110, 60];
    const shL: [number, number] = [94, 62];
    const shR: [number, number] = [126, 62];
    const hip: [number, number] = [110, 98];
    const kneeL: [number, number] = [94, 112]; const footL: [number, number] = [94, 136];
    const kneeR: [number, number] = [126, 112]; const footR: [number, number] = [126, 136];

    const handleY = lerp(56, 16, t);
    const handL: [number, number] = [74, handleY];
    const handR: [number, number] = [146, handleY];
    const elbowL = lerpPt([76, 80], [82, 38], t);
    const elbowR = lerpPt([144, 80], [138, 38], t);

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "shoulder_press_machine", handleY, lift: t }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 37 || n.includes("pike push-up") || n.includes("pike")) {
    const hip: [number, number] = [96, 60];
    const kneeL: [number, number] = [72, 98]; const footL: [number, number] = [48, 134];
    const kneeR: [number, number] = [70, 98]; const footR: [number, number] = [46, 134];
    const handL: [number, number] = [146, 134]; const handR: [number, number] = [144, 134];

    const shoulder = lerpPt([134, 106], [122, 88], t);
    const head = lerpPt([146, 120], [132, 76], t);
    const elbowL = lerpPt([126, 124], [134, 112], t);

    return {
      view: "side",
      props: [{ type: "floor", y: 136 }],
      head, shoulder, shL: shoulder, shR: shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 104 || n.includes("seated dumbbell shoulder press")) {
    const head: [number, number] = [110, 44];
    const shoulder: [number, number] = [110, 60];
    const shL: [number, number] = [94, 62];
    const shR: [number, number] = [126, 62];
    const hip: [number, number] = [110, 98];
    const kneeL: [number, number] = [92, 112]; const footL: [number, number] = [92, 136];
    const kneeR: [number, number] = [128, 112]; const footR: [number, number] = [128, 136];

    const handL = lerpPt([74, 56], [88, 16], t);
    const handR = lerpPt([146, 56], [132, 16], t);
    const elbowL = lerpPt([76, 78], [84, 38], t);
    const elbowR = lerpPt([144, 78], [136, 38], t);

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "seated_bench_front" },
        { type: "dumbbells_pair", handL, handR }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 4 || (n.includes("shoulder press") || (exercise.primary_muscle === "shoulders" && !n.includes("shrug") && !n.includes("row")))) {
    const head: [number, number] = [110, 40];
    const shoulder: [number, number] = [110, 56];
    const shL: [number, number] = [94, 58];
    const shR: [number, number] = [126, 58];
    const hip: [number, number] = [110, 94];
    const kneeL: [number, number] = [98, 116]; const footL: [number, number] = [96, 136];
    const kneeR: [number, number] = [122, 116]; const footR: [number, number] = [124, 136];

    const handL = lerpPt([74, 52], [88, 14], t);
    const handR = lerpPt([146, 52], [132, 14], t);
    const elbowL = lerpPt([76, 74], [84, 36], t);
    const elbowR = lerpPt([144, 74], [136, 36], t);

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "dumbbells_pair", handL, handR }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 106 || n.includes("upright row")) {
    const head: [number, number] = [110, 34];
    const shoulder: [number, number] = [110, 50];
    const shL: [number, number] = [95, 52];
    const shR: [number, number] = [125, 52];
    const hip: [number, number] = [110, 92];
    const kneeL: [number, number] = [98, 114]; const footL: [number, number] = [96, 136];
    const kneeR: [number, number] = [122, 114]; const footR: [number, number] = [124, 136];

    const barY = lerp(92, 58, t);
    const handL: [number, number] = [98, barY];
    const handR: [number, number] = [122, barY];
    const elbowL = lerpPt([90, 72], [68, 42], t);
    const elbowR = lerpPt([130, 72], [152, 42], t);

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "barbell_front", y: barY, w: 58 }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 108 || n.includes("barbell shrug")) {
    const head: [number, number] = [110, 32];
    const elevate = lerp(0, -10, t);
    const shoulder: [number, number] = [110, 52 + elevate * 0.6];
    const shL: [number, number] = [93, 54 + elevate];
    const shR: [number, number] = [127, 54 + elevate];
    const hip: [number, number] = [110, 94];
    const kneeL: [number, number] = [98, 116]; const footL: [number, number] = [96, 136];
    const kneeR: [number, number] = [122, 116]; const footR: [number, number] = [124, 136];

    const barY = 94 + elevate;
    const elbowL: [number, number] = [91, 74 + elevate];
    const handL: [number, number] = [90, barY];
    const elbowR: [number, number] = [129, 74 + elevate];
    const handR: [number, number] = [130, barY];

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "barbell_front", y: barY, w: 66 }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 109 || n.includes("dumbbell shrug") || (exercise.primary_muscle === "traps" && !n.includes("pull") && !n.includes("deadlift"))) {
    const head: [number, number] = [110, 32];
    const elevate = lerp(0, -10, t);
    const shoulder: [number, number] = [110, 52 + elevate * 0.6];
    const shL: [number, number] = [93, 54 + elevate];
    const shR: [number, number] = [127, 54 + elevate];
    const hip: [number, number] = [110, 94];
    const kneeL: [number, number] = [98, 116]; const footL: [number, number] = [96, 136];
    const kneeR: [number, number] = [122, 116]; const footR: [number, number] = [124, 136];

    const elbowL: [number, number] = [86, 74 + elevate];
    const handL: [number, number] = [84, 94 + elevate];
    const elbowR: [number, number] = [134, 74 + elevate];
    const handR: [number, number] = [136, 94 + elevate];

    return {
      view: "front",
      props: [
        { type: "floor", y: 138 },
        { type: "dumbbells_pair", handL, handR }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 101 || n.includes("rack pull")) {
    const hip = lerpPt([74, 80], [98, 76], t);
    const shoulder = lerpPt([112, 54], [96, 38], t);
    const head = lerpPt([122, 42], [96, 24], t);
    const kneeL = lerpPt([104, 104], [99, 104], t);
    const footL: [number, number] = [102, 134];
    const kneeR: [number, number] = [kneeL[0] - 4, kneeL[1]];
    const footR: [number, number] = [footL[0] - 4, footL[1]];

    const handL = lerpPt([110, 98], [98, 78], t);
    const elbowL = lerpPt([111, 76], [97, 58], t);

    return {
      view: "side_rackpull",
      props: [
        { type: "floor", y: 136 },
        { type: "power_rack_pins", pinY: 100 },
        { type: "barbell_side", x: handL[0], y: handL[1], r: 12 }
      ],
      head, shoulder, shL: shoulder, shR: shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 100 || n.includes("snatch-grip deadlift") || (exercise.primary_muscle === "traps" && n.includes("deadlift"))) {
    const head = lerpPt([110, 56], [110, 28], t);
    const shoulder = lerpPt([110, 72], [110, 44], t);
    const shL: [number, number] = [94, shoulder[1] + 2];
    const shR: [number, number] = [126, shoulder[1] + 2];
    const hip = lerpPt([110, 98], [110, 82], t);
    const kneeL = lerpPt([92, 112], [98, 110], t);
    const kneeR = lerpPt([128, 112], [122, 110], t);
    const footL: [number, number] = [96, 134];
    const footR: [number, number] = [124, 134];

    const barY = lerp(118, 84, t);
    const handL: [number, number] = [68, barY];
    const handR: [number, number] = [152, barY];
    const elbowL = lerpPt([80, 94], [80, 64], t);
    const elbowR = lerpPt([140, 94], [140, 64], t);

    return {
      view: "front",
      props: [
        { type: "floor", y: 136 },
        { type: "barbell_front", y: barY, w: 96 }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  // ==========================================
  // 9. TRICEPS CATALOG (13 GERAKAN KHUSUS)
  // ==========================================
  if (id === 72 || n.includes("cable tricep kickback")) {
    const hip: [number, number] = [74, 80];
    const shoulder: [number, number] = [116, 62];
    const head: [number, number] = [130, 56];
    const kneeL: [number, number] = [86, 108]; const footL: [number, number] = [84, 134];
    const elbowL: [number, number] = [86, 66];
    const handL = lerpPt([94, 92], [58, 66], t);

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "low_cable_right", pulleyX: 168, pulleyY: 118, hand: handL, lift: t }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: [112, 82], handR: [96, 98],
      kneeL, footL, kneeR: [80, 108], footR: [78, 134],
      contraction: t,
    };
  }

  if (id === 44 || n.includes("chair / bench dips") || n.includes("bench dips")) {
    const handL: [number, number] = [66, 94];
    const elbowL = lerpPt([52, 78], [64, 72], t);
    const shoulder = lerpPt([78, 76], [78, 52], t);
    const head = lerpPt([80, 62], [80, 38], t);
    const hip = lerpPt([84, 114], [84, 90], t);
    const kneeL = lerpPt([118, 108], [120, 104], t);
    const footL: [number, number] = [152, 134];

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "dip_bench", x: 28, y: 94, w: 42, h: 42 }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR: [kneeL[0] - 4, kneeL[1]], footR: [footL[0] - 4, footL[1]],
      contraction: t,
    };
  }

  if (id === 68 || n.includes("close-grip barbell bench press") || n.includes("close-grip")) {
    const head: [number, number] = [48, 92];
    const shoulder: [number, number] = [66, 94];
    const hip: [number, number] = [110, 94];
    const kneeL: [number, number] = [138, 96]; const footL: [number, number] = [142, 134];
    const elbowL = lerpPt([84, 108], [76, 70], t);
    const handL = lerpPt([84, 82], [74, 46], t);

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "flat_bench", x: 40, y: 98, w: 92 },
        { type: "barbell_side", x: handL[0], y: handL[1], r: 10.5 }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR: kneeL, footR: footL,
      contraction: t,
    };
  }

  if (id === 27 || n.includes("diamond push-up")) {
    const footL: [number, number] = [42, 134];
    const handL: [number, number] = [134, 134];
    const hip = lerpPt([88, 118], [90, 98], t);
    const kneeL = lerpPt([64, 126], [66, 116], t);
    const shoulder = lerpPt([132, 110], [134, 82], t);
    const head = lerpPt([148, 108], [150, 78], t);
    const elbowL = lerpPt([112, 122], [134, 108], t);

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "diamond_marker", x: 134, y: 134 }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR: kneeL, footR: footL,
      contraction: t,
    };
  }

  if (id === 71 || n.includes("dumbbell tricep kickback")) {
    const hip: [number, number] = [72, 76];
    const shoulder: [number, number] = [116, 68];
    const head: [number, number] = [130, 64];
    const kneeL: [number, number] = [62, 104]; const footL: [number, number] = [54, 134];
    const kneeR: [number, number] = [82, 98]; const footR: [number, number] = [68, 98];
    const elbowR: [number, number] = [116, 84]; const handR: [number, number] = [116, 98];
    const elbowL: [number, number] = [84, 68];
    const handL = lerpPt([90, 94], [56, 66], t);

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "flat_bench", x: 66, y: 98, w: 62 },
        { type: "dumbbell_side", x: handL[0], y: handL[1] }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 70 || n.includes("overhead cable triceps extension")) {
    const hip: [number, number] = [104, 88];
    const shoulder: [number, number] = [110, 52];
    const head: [number, number] = [114, 38];
    const kneeL: [number, number] = [116, 112]; const footL: [number, number] = [122, 134];
    const kneeR: [number, number] = [94, 112]; const footR: [number, number] = [88, 134];
    const elbowL: [number, number] = [114, 34];
    const handL = lerpPt([94, 48], [136, 18], t);

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "overhead_cable_left", pulleyX: 52, pulleyY: 42, hand: handL, lift: t }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 69 || n.includes("overhead dumbbell triceps extension")) {
    const hip: [number, number] = [104, 92];
    const shoulder: [number, number] = [104, 54];
    const head: [number, number] = [106, 40];
    const kneeL: [number, number] = [108, 114]; const footL: [number, number] = [110, 134];
    const kneeR: [number, number] = [100, 114]; const footR: [number, number] = [100, 134];
    const elbowL: [number, number] = [102, 30];
    const handL = lerpPt([86, 50], [102, 8], t);

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "dumbbell_side", x: handL[0], y: handL[1] }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 74 || n.includes("overhead ez-bar french press") || n.includes("french press")) {
    const hip: [number, number] = [100, 98];
    const shoulder: [number, number] = [100, 60];
    const head: [number, number] = [102, 46];
    const kneeL: [number, number] = [126, 98]; const footL: [number, number] = [128, 134];
    const elbowL: [number, number] = [98, 36];
    const handL = lerpPt([80, 54], [98, 12], t);

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "short_seat", x: 86, y: 102 },
        { type: "ez_bar_side", x: handL[0], y: handL[1] }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR: kneeL, footR: footL,
      contraction: t,
    };
  }

  if (id === 73 || n.includes("parallel bar dips")) {
    const handL: [number, number] = [104, 68];
    const lift = lerp(18, 0, t);
    const elbowL = lerpPt([86, 58], [102, 50], t);
    const shoulder: [number, number] = [104, 34 + lift];
    const head: [number, number] = [106, 20 + lift];
    const hip: [number, number] = [100, 74 + lift];
    const kneeL: [number, number] = [100, 102 + lift];
    const footL: [number, number] = [92, 122 + lift];

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "parallel_dip_bars", x: 104, y: 68 }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR: kneeL, footR: footL,
      contraction: t,
    };
  }

  if (id === 75 || n.includes("single-arm cable tricep pushdown")) {
    const head: [number, number] = [102, 32];
    const shoulder: [number, number] = [102, 48];
    const shL: [number, number] = [88, 50];
    const shR: [number, number] = [116, 50];
    const hip: [number, number] = [102, 90];
    const kneeL: [number, number] = [94, 112]; const footL: [number, number] = [92, 134];
    const kneeR: [number, number] = [110, 112]; const footR: [number, number] = [112, 134];
    const elbowR: [number, number] = [118, 70];
    const handR = lerpPt([112, 56], [122, 92], t);
    const elbowL: [number, number] = [78, 68];
    const handL: [number, number] = [88, 84];

    return {
      view: "front_single_pushdown",
      props: [
        { type: "floor", y: 136 },
        { type: "front_cable_tower", pulleyX: 144, pulleyY: 16, hand: handR, lift: t }
      ],
      head, shoulder, shL, shR, hip,
      elbowL, handL, elbowR, handR,
      kneeL, footL, kneeR, footR,
      contraction: t,
    };
  }

  if (id === 47 || n.includes("skull crusher")) {
    const head: [number, number] = [52, 92];
    const shoulder: [number, number] = [68, 94];
    const hip: [number, number] = [112, 94];
    const kneeL: [number, number] = [140, 96]; const footL: [number, number] = [144, 134];
    const elbowL: [number, number] = [66, 68];
    const handL = lerpPt([46, 82], [66, 42], t);

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "flat_bench", x: 42, y: 98, w: 94 },
        { type: "ez_bar_side", x: handL[0], y: handL[1] }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR: kneeL, footR: footL,
      contraction: t,
    };
  }

  if (id === 48 || n.includes("tricep rope pushdown") || (n.includes("rope") && n.includes("pushdown"))) {
    const head: [number, number] = [84, 30];
    const shoulder: [number, number] = [82, 46];
    const hip: [number, number] = [78, 86];
    const kneeL: [number, number] = [82, 110]; const footL: [number, number] = [84, 134];
    const elbowL: [number, number] = [86, 68];
    const handL = lerpPt([104, 54], [84, 92], t);
    const handR = lerpPt([106, 56], [96, 90], t);

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "high_cable_right", pulleyX: 148, pulleyY: 16, handL, handR, isRope: true, lift: t }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR,
      kneeL, footL, kneeR: [74, 110], footR: [76, 134],
      contraction: t,
    };
  }

  if (id === 6 || n.includes("tricep") || exercise.primary_muscle === "triceps") {
    const head: [number, number] = [84, 30];
    const shoulder: [number, number] = [82, 46];
    const hip: [number, number] = [78, 86];
    const kneeL: [number, number] = [82, 110]; const footL: [number, number] = [84, 134];
    const elbowL: [number, number] = [86, 68];
    const handL = lerpPt([106, 56], [92, 92], t);

    return {
      view: "side",
      props: [
        { type: "floor", y: 136 },
        { type: "high_cable_right", pulleyX: 148, pulleyY: 16, handL, handR: handL, isRope: false, lift: t }
      ],
      head, shoulder, hip,
      elbowL, handL, elbowR: elbowL, handR: handL,
      kneeL, footL, kneeR: [74, 110], footR: [76, 134],
      contraction: t,
    };
  }

  // GENERAL FALLBACK
  const yB = lerp(0, 16, t);
  return {
    props: [{ type: "floor", y: 128 }],
    head: [100, 44 - yB], shoulder: [100, 58 - yB], hip: [100, 94 - yB],
    elbowL: [88, 74 - yB], handL: [82, 88 - yB],
    elbowR: [112, 74 - yB], handR: [118, 88 - yB],
    kneeL: [96, 112], footL: [94, 126],
    kneeR: [104, 112], footR: [106, 126],
    contraction: t,
  };
}

export function ExerciseStickmanCanvas({
  exercise,
  className,
  heightClass = "h-64 sm:h-72",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<0.5 | 1 | 1.5>(1);
  const [contractionVal, setContractionVal] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let animTime = 0;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (isPlaying) {
        animTime += dt * speed;
      }

      // Smooth cosine 1.5s - 1.6s period
      const phase = (1 - Math.cos(animTime * Math.PI * 1.33)) / 2;
      setContractionVal(phase);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Coordinate scaling (200x150 or 220x155 coordinate space for delts/traps/triceps)
      const primary = exercise.primary_muscle || "abs";
      const isRearDelts = primary === "rear delts";
      const isShoulders = primary === "shoulders";
      const isTraps = primary === "traps";
      const isTriceps = primary === "triceps";
      const is220 = isRearDelts || isShoulders || isTraps || isTriceps;
      const refW = is220 ? 220 : 200;
      const refH = is220 ? 155 : 150;

      const scale = Math.min(width / refW, height / refH);
      const offsetX = (width - refW * scale) / 2;
      const offsetY = (height - refH * scale) / 2;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      const pose = getPose(exercise, phase, animTime);
      const sec = exercise.secondary_muscles || [];
      const c = pose.contraction;

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // 1. Draw Props
      pose.props.forEach((p) => {
        if (p.type === "floor") {
          ctx.strokeStyle = "#1e293b";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(15, p.y);
          ctx.lineTo(is220 ? 205 : 185, p.y);
          ctx.stroke();
        } else if (p.type === "reverse_pec_deck_machine") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(64, 14); ctx.lineTo(156, 14);
          ctx.moveTo(110, 14); ctx.lineTo(110, 136);
          ctx.stroke();

          ctx.fillStyle = "#1e293b";
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 2;
          ctx.fillRect(96, 52, 28, 34);
          ctx.strokeRect(96, 52, 28, 34);
          ctx.fillRect(92, 96, 36, 6);

          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(86, 14); ctx.lineTo(p.handL[0], p.handL[1]);
          ctx.moveTo(134, 14); ctx.lineTo(p.handR[0], p.handR[1]);
          ctx.stroke();
        } else if (p.type === "facepull_cable") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(176, 16); ctx.lineTo(176, 136);
          ctx.moveTo(164, 16); ctx.lineTo(188, 16);
          ctx.stroke();

          const stackY = 98 - p.lift * 32;
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(167, stackY, 18, 16);

          ctx.fillStyle = "#64748b";
          ctx.beginPath();
          ctx.arc(p.pulleyX, p.pulleyY, 5, 0, Math.PI * 2);
          ctx.fill();

          const ropeSplit: [number, number] = [
            lerp(p.pulleyX, p.handL[0], 0.72),
            lerp(p.pulleyY, p.handL[1], 0.72),
          ];
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(p.pulleyX, p.pulleyY);
          ctx.lineTo(ropeSplit[0], ropeSplit[1]);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.strokeStyle = "#e2e8f0";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(ropeSplit[0], ropeSplit[1]);
          ctx.lineTo(p.handL[0], p.handL[1]);
          ctx.moveTo(ropeSplit[0], ropeSplit[1]);
          ctx.lineTo(p.handR[0], p.handR[1]);
          ctx.stroke();
        } else if (p.type === "seated_bench_front") {
          ctx.fillStyle = "#1e293b";
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 2.5;
          ctx.fillRect(98, 46, 24, 52);
          ctx.strokeRect(98, 46, 24, 52);
          ctx.fillRect(90, 98, 40, 6);
          ctx.beginPath();
          ctx.moveTo(110, 104); ctx.lineTo(110, 138);
          ctx.stroke();
        } else if (p.type === "shoulder_press_machine") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4;
          ctx.strokeRect(62, 12, 96, 126);

          ctx.fillStyle = "#1e293b";
          ctx.fillRect(96, 48, 28, 52);
          ctx.fillRect(90, 100, 40, 6);

          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(62, p.handleY); ctx.lineTo(82, p.handleY);
          ctx.moveTo(138, p.handleY); ctx.lineTo(158, p.handleY);
          ctx.stroke();
        } else if (p.type === "low_cable_side") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(p.pulleyX, 18); ctx.lineTo(p.pulleyX, 138);
          ctx.stroke();

          const stackY = 98 - p.lift * 30;
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(p.pulleyX - 7, stackY, 14, 16);

          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(p.pulleyX, p.pulleyY);
          ctx.lineTo(p.hand[0], p.hand[1]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (p.type === "power_rack_pins") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(86, 16); ctx.lineTo(86, 136);
          ctx.moveTo(134, 16); ctx.lineTo(134, 136);
          ctx.stroke();

          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(82, p.pinY); ctx.lineTo(138, p.pinY);
          ctx.stroke();
        } else if (p.type === "dip_bench") {
          ctx.fillStyle = "#1e293b";
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 2.5;
          ctx.fillRect(p.x, p.y, p.w, 8);
          ctx.strokeRect(p.x, p.y, p.w, 8);
          ctx.beginPath();
          ctx.moveTo(p.x + 6, p.y + 8); ctx.lineTo(p.x + 6, 136);
          ctx.moveTo(p.x + p.w - 6, p.y + 8); ctx.lineTo(p.x + p.w - 6, 136);
          ctx.stroke();
        } else if (p.type === "flat_bench") {
          ctx.fillStyle = "#1e293b";
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 2.5;
          ctx.fillRect(p.x, p.y, p.w, 6);
          ctx.strokeRect(p.x, p.y, p.w, 6);
          ctx.beginPath();
          ctx.moveTo(p.x + 10, p.y + 6); ctx.lineTo(p.x + 10, 136);
          ctx.moveTo(p.x + p.w - 10, p.y + 6); ctx.lineTo(p.x + p.w - 10, 136);
          ctx.stroke();
        } else if (p.type === "short_seat") {
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 28, p.y);
          ctx.moveTo(p.x + 14, p.y); ctx.lineTo(p.x + 14, 136);
          ctx.stroke();
        } else if (p.type === "parallel_dip_bars") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(76, p.y); ctx.lineTo(136, p.y);
          ctx.moveTo(82, p.y); ctx.lineTo(82, 136);
          ctx.moveTo(130, p.y); ctx.lineTo(130, 136);
          ctx.stroke();
        } else if (p.type === "diamond_marker") {
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - 5);
          ctx.lineTo(p.x + 5, p.y);
          ctx.lineTo(p.x, p.y + 5);
          ctx.lineTo(p.x - 5, p.y);
          ctx.closePath();
          ctx.stroke();
        } else if (p.type === "overhead_cable_left") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(p.pulleyX, 16); ctx.lineTo(p.pulleyX, 136);
          ctx.stroke();

          const stackY = 96 - p.lift * 30;
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(p.pulleyX - 7, stackY, 14, 16);

          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(p.pulleyX, p.pulleyY);
          ctx.lineTo(p.hand[0], p.hand[1]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (p.type === "front_cable_tower") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(p.pulleyX + 12, 16);
          ctx.lineTo(p.pulleyX + 12, 136);
          ctx.moveTo(p.pulleyX, 16);
          ctx.lineTo(p.pulleyX + 16, 16);
          ctx.stroke();

          const stackY = 96 - p.lift * 30;
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(p.pulleyX + 5, stackY, 14, 16);

          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(p.pulleyX, p.pulleyY);
          ctx.lineTo(p.hand[0], p.hand[1]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (p.type === "high_cable_right") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4.5;
          ctx.beginPath();
          ctx.moveTo(p.pulleyX + 12, 16);
          ctx.lineTo(p.pulleyX + 12, 136);
          ctx.moveTo(p.pulleyX, 16);
          ctx.lineTo(p.pulleyX + 16, 16);
          ctx.stroke();

          const stackY = 96 - p.lift * 30;
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(p.pulleyX + 5, stackY, 14, 16);

          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(p.pulleyX, p.pulleyY);
          ctx.lineTo(p.handL[0], p.handL[1]);
          ctx.stroke();
          ctx.setLineDash([]);

          if (p.isRope) {
            ctx.strokeStyle = "#f8fafc";
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(p.handL[0], p.handL[1] - 6);
            ctx.lineTo(p.handL[0] - 4, p.handL[1] + 2);
            ctx.moveTo(p.handL[0], p.handL[1] - 6);
            ctx.lineTo(p.handR[0] + 4, p.handR[1] + 2);
            ctx.stroke();
          }
        } else if (p.type === "jump_rope" && p.behind) {
          ctx.save();
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(p.handL[0], p.handL[1]);
          ctx.quadraticCurveTo(100, p.peakY, p.handR[0], p.handR[1]);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "rowing_machine") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(45, 114);
          ctx.lineTo(168, 114);
          ctx.stroke();
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(52, 114);
          ctx.lineTo(48, 132);
          ctx.moveTo(160, 114);
          ctx.lineTo(164, 132);
          ctx.stroke();

          // Flywheel at [40, 82]
          ctx.fillStyle = "#0f172a";
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(40, 82, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          for (let i = 0; i < 3; i++) {
            const a = p.spin + (i * Math.PI) / 1.5;
            ctx.strokeStyle = "#0284c7";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(40 + Math.cos(a) * 11, 82 + Math.sin(a) * 11);
            ctx.lineTo(40 - Math.cos(a) * 11, 82 - Math.sin(a) * 11);
            ctx.stroke();
          }

          // Sliding seat
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(p.seatX - 7, 107, 14, 5);

          // Chain handle
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 1.6;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(52, 76);
          ctx.lineTo(p.handleX, p.handleY);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (p.type === "treadmill") {
          ctx.fillStyle = "#0f172a";
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(42, 118, 110, 11, 5);
          } else {
            ctx.rect(42, 118, 110, 11);
          }
          ctx.fill();
          ctx.stroke();

          // Moving belt hashes
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2;
          for (let x = 50; x < 145; x += 18) {
            const bx = 145 - ((x + p.beltOffset) % 95);
            ctx.beginPath();
            ctx.moveTo(bx, 119);
            ctx.lineTo(bx - 4, 127);
            ctx.stroke();
          }

          // Console column & monitor
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(142, 118);
          ctx.lineTo(154, 48);
          ctx.lineTo(136, 48);
          ctx.stroke();
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.moveTo(148, 46);
          ctx.lineTo(162, 34);
          ctx.lineTo(156, 30);
          ctx.lineTo(142, 42);
          ctx.closePath();
          ctx.fill();
        } else if (p.type === "step_block") {
          ctx.fillStyle = "#1e293b";
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 2;
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.strokeRect(p.x, p.y, p.w, p.h);
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(p.x + 2, p.y);
          ctx.lineTo(p.x + p.w - 2, p.y);
          ctx.stroke();
        } else if (p.type === "balance_post") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y1);
          ctx.lineTo(p.x, p.y2);
          ctx.stroke();
        } else if (p.type === "seated_calf_machine") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(p.seatX, p.seatY);
          ctx.lineTo(p.seatX + 30, p.seatY);
          ctx.stroke();
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(p.seatX + 12, p.seatY);
          ctx.lineTo(p.seatX + 12, 134);
          ctx.stroke();

          const pivotX = 148;
          const pivotY = 86;
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(pivotX, 55);
          ctx.lineTo(pivotX, 134);
          ctx.stroke();

          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(pivotX, pivotY);
          ctx.lineTo(p.kneeX, p.kneeY - 7);
          ctx.stroke();

          const platePos = lerpPt([pivotX, pivotY], [p.kneeX, p.kneeY - 7], 0.45);
          ctx.fillStyle = "#38bdf8";
          ctx.strokeStyle = "#0284c7";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(platePos[0], platePos[1], 8.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(p.kneeX - 10, p.kneeY - 10, 18, 6);
        } else if (p.type === "standing_calf_machine") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(142, 12);
          ctx.lineTo(142, 134);
          ctx.stroke();

          const stackY = 98 - p.t * 24;
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(134, stackY, 16, 18);

          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(142, p.shoulderY - 4);
          ctx.lineTo(p.shoulderX - 6, p.shoulderY - 4);
          ctx.stroke();

          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(p.shoulderX - 9, p.shoulderY - 8, 18, 6.5);
        } else if (p.type === "wheel") {
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "band") {
          ctx.save();
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2.2 + p.tension * 1.2;
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 4 * p.tension;
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y1);
          ctx.lineTo(p.x2, p.y2);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "cable_machine") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(158, 22);
          ctx.lineTo(158, 132);
          ctx.stroke();

          const stackY = 105 - p.weightLift * 35;
          ctx.fillStyle = "#475569";
          ctx.fillRect(151, stackY, 14, 16);

          ctx.fillStyle = "#64748b";
          ctx.beginPath();
          ctx.arc(p.pulleyX, p.pulleyY, 4.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.moveTo(p.pulleyX, p.pulleyY);
          ctx.lineTo(p.handX, p.handY);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (p.type === "pullup_bar") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(p.x - 38, p.y);
          ctx.lineTo(p.x + 38, p.y);
          ctx.stroke();
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "cable") {
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y1);
          ctx.lineTo(p.x2, p.y2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#475569";
          ctx.beginPath();
          ctx.arc(p.x1, p.y1, 5, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "bench_decline") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y1);
          ctx.lineTo(p.x2, p.y2);
          ctx.lineTo(p.x3, p.y3);
          ctx.stroke();
        } else if (p.type === "bench_flat") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y);
          ctx.lineTo(p.x2, p.y);
          ctx.stroke();
        } else if (p.type === "bench_box") {
          ctx.fillStyle = "#1e293b";
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 2.5;
          ctx.fillRect(p.x, p.y, p.w, p.h);
          ctx.strokeRect(p.x, p.y, p.w, p.h);
        } else if (p.type === "incline_bench") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y1);
          ctx.lineTo(p.x2, p.y2);
          ctx.lineTo(p.x3, p.y3);
          ctx.stroke();
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(72, 72);
          ctx.lineTo(65, 132);
          ctx.moveTo(112, 98);
          ctx.lineTo(116, 132);
          ctx.stroke();
        } else if (p.type === "preacher_bench") {
          ctx.strokeStyle = "#334155";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(p.seatX, p.seatY);
          ctx.lineTo(p.seatX + 26, p.seatY);
          ctx.moveTo(p.seatX + 13, p.seatY);
          ctx.lineTo(p.seatX + 13, 132);
          ctx.stroke();
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(p.padX1, p.padY1);
          ctx.lineTo(p.padX2, p.padY2);
          ctx.stroke();
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(100, 70);
          ctx.lineTo(100, 132);
          ctx.stroke();
        } else if (p.type === "post") {
          ctx.strokeStyle = "#475569";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y1);
          ctx.lineTo(p.x, p.y2);
          ctx.stroke();
        } else if (p.type === "barbell") {
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          ctx.moveTo(p.x1, p.y1);
          ctx.lineTo(p.x2, p.y2);
          ctx.stroke();
          ctx.fillStyle = "#e2e8f0";
          ctx.beginPath();
          ctx.arc(p.x1, p.y1, p.r ?? 6, 0, Math.PI * 2);
          ctx.arc(p.x2, p.y2, p.r ?? 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "dumbbell") {
          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 2. Draw Stickman Limbs with Glowing Highlights
      const drawLimb = (
        pt1: [number, number],
        pt2: [number, number],
        color: string,
        lineWidth: number,
        glowColor: string | null = null,
        glowBlur = 0
      ) => {
        ctx.save();
        if (glowColor && glowBlur > 0) {
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = glowBlur;
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(pt1[0], pt1[1]);
        ctx.lineTo(pt2[0], pt2[1]);
        ctx.stroke();
        ctx.restore();
      };

      const isChest = primary === "chest";
      const isBack = primary === "lats" || primary === "middle back" || primary === "lower back";
      const isLegs = primary === "quadriceps" || primary === "hamstrings" || primary === "glutes";
      const isBiceps = primary === "biceps";
      const isAbs = primary === "abs" || primary === "obliques";
      const isCalves = primary === "calves";
      const isCardio = primary === "cardio";

      const neutralColor = "#94a3b8";
      const secondaryColor = "#f59e0b"; // Amber
      const primaryColor = "#ef4444"; // Glowing Red

      const hasQuadsOrLegs = sec.includes("quadriceps") || sec.includes("legs");
      const hasCalvesOrLegs = sec.includes("calves") || sec.includes("legs");
      const hasChest = sec.includes("chest");
      const hasCore = sec.includes("core");
      const hasBack = sec.includes("back");
      const hasShouldersSec = sec.includes("shoulders");
      const hasTraps = sec.includes("traps");
      const hasMidBack = sec.includes("mid back") || sec.includes("middle back");
      const hasRotatorCuff = sec.includes("rotator cuff");
      const hasHamstrings = sec.includes("hamstrings");
      const hasTricepsSec = sec.includes("triceps");
      const hasBicepsSec = sec.includes("biceps");
      const hasForearms = sec.includes("forearms");
      const hasGlutes = sec.includes("glutes");
      const hasLowerBack = sec.includes("lower back");
      const hasUpperChest = sec.includes("upper chest");

      if (isRearDelts) {
        if (pose.view === "side_facepull") {
          drawLimb(pose.hip, pose.kneeR, "#64748b", 4.2);
          drawLimb(pose.kneeR, pose.footR, "#64748b", 3.8);
          drawLimb(pose.hip, pose.kneeL, neutralColor, 4.6);
          drawLimb(pose.kneeL, pose.footL, neutralColor, 4.2);

          drawLimb(pose.shoulder, pose.hip, "#cbd5e1", 6);

          if (hasTraps) {
            drawLimb(
              [pose.head[0] - 2, pose.head[1] + 6],
              [pose.shoulder[0] - 5, pose.shoulder[1] + 2],
              secondaryColor,
              5.5 + 1.5 * c,
              secondaryColor,
              8 * c
            );
          }

          drawLimb(pose.shoulder, pose.elbowR, "#64748b", 3.8);
          drawLimb(pose.elbowR, pose.handR, "#64748b", 3.5);

          if (hasRotatorCuff) {
            const cuffPos: [number, number] = [pose.shoulder[0] - 6, pose.shoulder[1] + 6];
            ctx.save();
            ctx.fillStyle = secondaryColor;
            ctx.shadowColor = secondaryColor;
            ctx.shadowBlur = 9 * c;
            ctx.beginPath();
            ctx.arc(cuffPos[0], cuffPos[1], 4.2 + 1.8 * c, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          drawLimb(pose.shoulder, pose.elbowL, primaryColor, 5.2 + 1.5 * c, primaryColor, 10 * c);
          drawLimb(
            pose.elbowL,
            pose.handL,
            hasRotatorCuff ? secondaryColor : neutralColor,
            4.2,
            secondaryColor,
            hasRotatorCuff ? 7 * c : 0
          );

          const rearDeltPos: [number, number] = [pose.shoulder[0] - 3, pose.shoulder[1] + 1];
          ctx.save();
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + 0.55 * c})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(rearDeltPos[0], rearDeltPos[1], 7.5 + 5 * c, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = primaryColor;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 14 + 14 * c;
          ctx.beginPath();
          ctx.arc(rearDeltPos[0], rearDeltPos[1], 5.2 + 3 * c, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          const shL = pose.shL || [pose.shoulder[0] - 24, pose.shoulder[1]];
          const shR = pose.shR || [pose.shoulder[0] + 24, pose.shoulder[1]];

          drawLimb(pose.hip, pose.kneeL, neutralColor, 4.6);
          drawLimb(pose.kneeL, pose.footL, neutralColor, 4.2);
          drawLimb(pose.hip, pose.kneeR, neutralColor, 4.6);
          drawLimb(pose.kneeR, pose.footR, neutralColor, 4.2);

          drawLimb(pose.shoulder, pose.hip, "#cbd5e1", 6.5);
          drawLimb(shL, shR, "#cbd5e1", 5.5);

          if (hasMidBack) {
            const midBackPt = lerpPt(pose.shoulder, pose.hip, 0.32);
            ctx.save();
            ctx.fillStyle = secondaryColor;
            ctx.shadowColor = secondaryColor;
            ctx.shadowBlur = 10 * c;
            ctx.beginPath();
            ctx.ellipse(midBackPt[0], midBackPt[1], 7 + 3 * c, 4.5 + 1.5 * c, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          if (hasTraps) {
            const neckBase: [number, number] = [pose.shoulder[0], pose.shoulder[1] - 5];
            drawLimb(shL, neckBase, secondaryColor, 5 + 2 * c, secondaryColor, 9 * c);
            drawLimb(shR, neckBase, secondaryColor, 5 + 2 * c, secondaryColor, 9 * c);
          }

          drawLimb(shL, pose.elbowL, primaryColor, 4.8 + 1.5 * c, primaryColor, 8 * c);
          drawLimb(pose.elbowL, pose.handL, neutralColor, 4);
          drawLimb(shR, pose.elbowR, primaryColor, 4.8 + 1.5 * c, primaryColor, 8 * c);
          drawLimb(pose.elbowR, pose.handR, neutralColor, 4);

          [shL, shR].forEach((shPt) => {
            ctx.save();
            ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + 0.55 * c})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(shPt[0], shPt[1], 7 + 4.5 * c, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = primaryColor;
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 14 + 12 * c;
            ctx.beginPath();
            ctx.arc(shPt[0], shPt[1], 4.8 + 2.8 * c, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });
        }
      } else if (isShoulders || isTraps) {
        if (pose.view === "front" || pose.shL) {
          const shL = pose.shL || [pose.shoulder[0] - 24, pose.shoulder[1]];
          const shR = pose.shR || [pose.shoulder[0] + 24, pose.shoulder[1]];
          const thighCol = hasHamstrings ? secondaryColor : neutralColor;

          drawLimb(pose.hip, pose.kneeL, thighCol, 4.8, secondaryColor, hasHamstrings ? 8 * c : 0);
          drawLimb(pose.kneeL, pose.footL, neutralColor, 4.2);
          drawLimb(pose.hip, pose.kneeR, thighCol, 4.8, secondaryColor, hasHamstrings ? 8 * c : 0);
          drawLimb(pose.kneeR, pose.footR, neutralColor, 4.2);

          if (sec.includes("lats") || hasMidBack) {
            ctx.save();
            ctx.fillStyle = `rgba(245, 158, 11, ${0.25 + 0.35 * c})`;
            ctx.strokeStyle = secondaryColor;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(shL[0], shL[1]);
            ctx.lineTo(pose.hip[0], pose.hip[1] - 6);
            ctx.lineTo(shR[0], shR[1]);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          const torsoCol = hasCore ? secondaryColor : "#cbd5e1";
          drawLimb(pose.shoulder, pose.hip, torsoCol, 6.5, secondaryColor, hasCore ? 8 * c : 0);
          drawLimb(shL, shR, "#cbd5e1", 5.5);

          const upperArmSec = hasTricepsSec || hasBicepsSec;
          const upperArmCol = upperArmSec ? secondaryColor : neutralColor;
          drawLimb(shL, pose.elbowL, upperArmCol, 4.8, secondaryColor, upperArmSec ? 8 * c : 0);
          drawLimb(shR, pose.elbowR, upperArmCol, 4.8, secondaryColor, upperArmSec ? 8 * c : 0);

          const forearmCol = hasForearms ? secondaryColor : neutralColor;
          drawLimb(pose.elbowL, pose.handL, forearmCol, 4.2, secondaryColor, hasForearms ? 8 * c : 0);
          drawLimb(pose.elbowR, pose.handR, forearmCol, 4.2, secondaryColor, hasForearms ? 8 * c : 0);

          const neckBase: [number, number] = [pose.head[0], pose.head[1] + 9];
          if (isTraps) {
            ctx.save();
            ctx.fillStyle = `rgba(239, 68, 68, ${0.45 + 0.45 * c})`;
            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 4.5 + 2 * c;
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 14 + 14 * c;
            ctx.beginPath();
            ctx.moveTo(shL[0], shL[1]);
            ctx.lineTo(neckBase[0], neckBase[1] - 2);
            ctx.lineTo(shR[0], shR[1]);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          } else if (hasTraps) {
            drawLimb(shL, neckBase, secondaryColor, 5.5 + 1.5 * c, secondaryColor, 8 * c);
            drawLimb(shR, neckBase, secondaryColor, 5.5 + 1.5 * c, secondaryColor, 8 * c);
          }

          if (isShoulders) {
            const activeShoulders =
              exercise.id === 40 || exercise.name.toLowerCase().includes("single-arm") ? [shL] : [shL, shR];
            activeShoulders.forEach((shPt) => {
              ctx.save();
              ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + 0.55 * c})`;
              ctx.lineWidth = 1.6;
              ctx.beginPath();
              ctx.arc(shPt[0], shPt[1], 7.5 + 4.5 * c, 0, Math.PI * 2);
              ctx.stroke();

              ctx.fillStyle = primaryColor;
              ctx.shadowColor = primaryColor;
              ctx.shadowBlur = 14 + 14 * c;
              ctx.beginPath();
              ctx.arc(shPt[0], shPt[1], 5.2 + 3 * c, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            });
          }
        } else {
          drawLimb(pose.hip, pose.kneeR, "#64748b", 4.2);
          drawLimb(pose.kneeR, pose.footR, "#64748b", 3.8);
          drawLimb(pose.hip, pose.kneeL, neutralColor, 4.8);
          drawLimb(pose.kneeL, pose.footL, neutralColor, 4.2);

          if (hasGlutes) {
            ctx.save();
            ctx.fillStyle = secondaryColor;
            ctx.shadowColor = secondaryColor;
            ctx.shadowBlur = 8 * c;
            ctx.beginPath();
            ctx.arc(pose.hip[0] - 3, pose.hip[1] + 2, 5 + 1.5 * c, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          const torsoSec = hasLowerBack || sec.includes("lats") || hasUpperChest;
          drawLimb(
            pose.shoulder,
            pose.hip,
            torsoSec ? secondaryColor : "#cbd5e1",
            6.2,
            secondaryColor,
            torsoSec ? 9 * c : 0
          );

          const armCol = hasTricepsSec ? secondaryColor : neutralColor;
          drawLimb(pose.shoulder, pose.elbowL, armCol, 4.8, secondaryColor, hasTricepsSec ? 8 * c : 0);
          drawLimb(pose.elbowL, pose.handL, neutralColor, 4.2);

          if (isTraps) {
            const neckPt = lerpPt(pose.shoulder, pose.head, 0.45);
            drawLimb(
              [pose.shoulder[0] - 4, pose.shoulder[1] + 2],
              neckPt,
              primaryColor,
              7.5 + 2.5 * c,
              primaryColor,
              14 + 14 * c
            );
            ctx.save();
            ctx.fillStyle = primaryColor;
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 14 + 12 * c;
            ctx.beginPath();
            ctx.arc(pose.shoulder[0] - 2, pose.shoulder[1] - 1, 5.5 + 3 * c, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            ctx.save();
            ctx.strokeStyle = `rgba(239, 68, 68, ${0.35 + 0.55 * c})`;
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(pose.shoulder[0], pose.shoulder[1], 7.5 + 4.5 * c, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = primaryColor;
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 14 + 14 * c;
            ctx.beginPath();
            ctx.arc(pose.shoulder[0], pose.shoulder[1], 5.2 + 3 * c, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }
      } else if (isTriceps) {
        if (pose.view === "front_single_pushdown") {
          const shL = pose.shL || [pose.shoulder[0] - 24, pose.shoulder[1]];
          const shR = pose.shR || [pose.shoulder[0] + 24, pose.shoulder[1]];

          drawLimb(pose.hip, pose.kneeL, neutralColor, 4.6);
          drawLimb(pose.kneeL, pose.footL, neutralColor, 4.2);
          drawLimb(pose.hip, pose.kneeR, neutralColor, 4.6);
          drawLimb(pose.kneeR, pose.footR, neutralColor, 4.2);

          drawLimb(pose.shoulder, pose.hip, "#cbd5e1", 6.5);
          drawLimb(shL, shR, "#cbd5e1", 5.5);

          drawLimb(shL, pose.elbowL, "#64748b", 4.2);
          drawLimb(pose.elbowL, pose.handL, "#64748b", 3.8);

          drawLimb(shR, pose.elbowR, primaryColor, 6.2 + 2.2 * c, primaryColor, 14 + 14 * c);
          drawLimb(pose.elbowR, pose.handR, neutralColor, 4.2);

          const triMid = lerpPt(shR, pose.elbowR, 0.5);
          ctx.save();
          ctx.fillStyle = primaryColor;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 14 + 12 * c;
          ctx.beginPath();
          ctx.arc(triMid[0] + 3, triMid[1], 4.5 + 2.8 * c, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          drawLimb(pose.hip, pose.kneeR, "#64748b", 4.2);
          drawLimb(pose.kneeR, pose.footR, "#64748b", 3.8);
          drawLimb(pose.hip, pose.kneeL, neutralColor, 4.8);
          drawLimb(pose.kneeL, pose.footL, neutralColor, 4.2);

          const torsoSec = hasChest || hasCore;
          drawLimb(
            pose.shoulder,
            pose.hip,
            torsoSec ? secondaryColor : "#cbd5e1",
            6.2,
            secondaryColor,
            torsoSec ? 9 * c : 0
          );

          if (hasShouldersSec) {
            ctx.save();
            ctx.fillStyle = secondaryColor;
            ctx.shadowColor = secondaryColor;
            ctx.shadowBlur = 9 * c;
            ctx.beginPath();
            ctx.arc(pose.shoulder[0], pose.shoulder[1], 5 + 1.5 * c, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          if (exercise.id === 71 || exercise.name.toLowerCase().includes("kickback")) {
            drawLimb(pose.shoulder, pose.elbowR, "#64748b", 3.8);
            drawLimb(pose.elbowR, pose.handR, "#64748b", 3.5);
          }

          drawLimb(pose.elbowL, pose.handL, neutralColor, 4.2);
          drawLimb(pose.shoulder, pose.elbowL, primaryColor, 6.2 + 2.4 * c, primaryColor, 14 + 14 * c);

          const midArm = lerpPt(pose.shoulder, pose.elbowL, 0.5);
          const dx = pose.elbowL[0] - pose.shoulder[0];
          const dy = pose.elbowL[1] - pose.shoulder[1];
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const bulgePos: [number, number] = [midArm[0] + nx * (2.5 + 3.2 * c), midArm[1] + ny * (2.5 + 3.2 * c)];

          ctx.save();
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.3 + 0.55 * c})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(bulgePos[0], bulgePos[1], 6.5 + 4.5 * c, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = primaryColor;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 14 + 12 * c;
          ctx.beginPath();
          ctx.arc(bulgePos[0], bulgePos[1], 4 + 3 * c, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else {
        // Legs
        if (isCalves) {
          const heelL = pose.heelL || pose.footL;
          const toeL = pose.toeL || [heelL[0] + 12, heelL[1]];
          const heelR = pose.heelR || pose.footR;
          const toeR = pose.toeR || [heelR[0] + 12, heelR[1]];

          // Inactive back leg
          drawLimb(pose.hip, pose.kneeR, "#475569", 4.2);
          if (pose.nonWorkingLeg) {
            drawLimb(pose.kneeR, heelR, "#475569", 3.8);
            drawLimb(heelR, toeR, "#475569", 3.5);
          } else {
            drawLimb(pose.kneeR, heelR, "#b91c1c", 4.2);
            drawLimb(heelR, toeR, "#475569", 3.8);
          }

          // Active front thigh
          drawLimb(pose.hip, pose.kneeL, neutralColor, 5);

          // Calves shin (knee -> heel) in glowing primary red
          drawLimb(pose.kneeL, heelL, primaryColor, 5.5 + 1.8 * c, primaryColor, 10 + 14 * c);

          // Calf muscle belly bulge (Gastrocnemius/Soleus)
          const bellyRatio = lerp(0.45, 0.34, c);
          const calfAnchor = lerpPt(pose.kneeL, heelL, bellyRatio);
          const dx = heelL[0] - pose.kneeL[0];
          const dy = heelL[1] - pose.kneeL[1];
          const len = Math.hypot(dx, dy) || 1;
          const backX = -dy / len;
          const backY = dx / len;
          const bulgePos: [number, number] = [
            calfAnchor[0] + backX * (3.5 + 3.2 * c),
            calfAnchor[1] + backY * (3.5 + 3.2 * c),
          ];

          ctx.save();
          ctx.fillStyle = primaryColor;
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 12 + 12 * c;
          ctx.beginPath();
          ctx.ellipse(
            bulgePos[0],
            bulgePos[1],
            3.2 + 2.8 * c,
            6.5 - 1.0 * c,
            Math.atan2(dy, dx) - Math.PI / 2,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.restore();

          // Pulse halo
          ctx.save();
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.25 + 0.55 * c})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(bulgePos[0], bulgePos[1], 6.5 + 4.5 * c, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // Foot sole (heel -> toe)
          drawLimb(heelL, toeL, "#f8fafc", 4.2);

          // Ankle & toe pivots
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(heelL[0], heelL[1], 2.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#38bdf8";
          ctx.beginPath();
          ctx.arc(toeL[0], toeL[1], 2.8, 0, Math.PI * 2);
          ctx.fill();

          // Heel lift indicator arrow
          const arrowX = heelL[0] - 14;
          const arrowY = heelL[1];
          ctx.save();
          ctx.strokeStyle = c > 0.5 ? "#ef4444" : "#64748b";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(arrowX, 126);
          ctx.lineTo(arrowX, arrowY);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(arrowX - 3, arrowY + 3);
          ctx.lineTo(arrowX, arrowY - 1);
          ctx.lineTo(arrowX + 3, arrowY + 3);
          ctx.stroke();
          ctx.restore();
        } else if (isCardio) {
          const thighCol = hasQuadsOrLegs ? secondaryColor : neutralColor;
          const calfCol = hasCalvesOrLegs ? secondaryColor : neutralColor;

          if (pose.frontView) {
            drawLimb(pose.hip, pose.kneeR, thighCol, 4.5, secondaryColor, hasQuadsOrLegs ? 7 * c : 0);
            drawLimb(pose.kneeR, pose.footR, calfCol, 4.2, secondaryColor, hasCalvesOrLegs ? 8 * c : 0);
            drawLimb(pose.hip, pose.kneeL, thighCol, 4.8, secondaryColor, hasQuadsOrLegs ? 8 * c : 0);
            drawLimb(pose.kneeL, pose.footL, calfCol, 4.4, secondaryColor, hasCalvesOrLegs ? 8 * c : 0);
          } else {
            drawLimb(pose.hip, pose.kneeR, hasQuadsOrLegs ? "#b45309" : "#64748b", 4.2);
            drawLimb(pose.kneeR, pose.footR, hasCalvesOrLegs ? "#b45309" : "#64748b", 3.8);
            drawLimb(pose.hip, pose.kneeL, thighCol, 4.8, secondaryColor, hasQuadsOrLegs ? 8 * c : 0);
            drawLimb(pose.kneeL, pose.footL, calfCol, 4.4, secondaryColor, hasCalvesOrLegs ? 8 * c : 0);
          }
        } else {
          const legColor = isLegs ? primaryColor : sec.includes("quadriceps") ? secondaryColor : neutralColor;
          const legGlow = isLegs ? 10 * c : 0;
          drawLimb(pose.hip, pose.kneeL, legColor, 4.5, isLegs ? primaryColor : null, legGlow);
          drawLimb(pose.kneeL, pose.footL, neutralColor, 4);
          drawLimb(pose.hip, pose.kneeR, legColor, 4.5, isLegs ? primaryColor : null, legGlow);
          drawLimb(pose.kneeR, pose.footR, neutralColor, 4);
        }

        // Torso
        const midTorso = lerpPt(pose.shoulder, pose.hip, 0.35);
        const hasLats = sec.includes("lats") || isBack;
        const torsoGlowCardio = isCardio && (hasBack || hasCore || hasChest);
        const upperTorsoColor = isChest || isBack ? primaryColor : hasLats || torsoGlowCardio ? secondaryColor : "#cbd5e1";
        const upperTorsoGlow = isChest || isBack ? 12 * c : hasLats || torsoGlowCardio ? 8 * c : 0;
        drawLimb(
          pose.shoulder,
          midTorso,
          upperTorsoColor,
          6,
          isChest || isBack || hasLats || torsoGlowCardio ? upperTorsoColor : null,
          upperTorsoGlow
        );

        // Core / Abs
        const coreColor = isAbs ? primaryColor : neutralColor;
        const coreGlow = isAbs ? 10 + 12 * c : 0;
        drawLimb(midTorso, pose.hip, coreColor, 6.5, isAbs ? primaryColor : null, coreGlow);

        if (isAbs) {
          const coreCenter = lerpPt(midTorso, pose.hip, 0.5);
          ctx.save();
          ctx.fillStyle = `rgba(239, 68, 68, ${0.25 + 0.45 * c})`;
          ctx.beginPath();
          ctx.arc(coreCenter[0], coreCenter[1], 6 + 4 * c, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Cardio Heartbeat Pulse & Mini EKG
        if (isCardio) {
          const heartPos = lerpPt(pose.shoulder, pose.hip, 0.32);
          const beat = (Math.sin(animTime * Math.PI * 4.2) + 1) / 2;

          ctx.save();
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.65 - beat * 0.45})`;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(heartPos[0], heartPos[1], 6 + beat * 9, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.fillStyle = primaryColor;
          ctx.shadowColor = primaryColor;
          ctx.shadowBlur = 12 + beat * 10;
          ctx.beginPath();
          ctx.arc(heartPos[0], heartPos[1], 4.5 + beat * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.strokeStyle = "rgba(239, 68, 68, 0.75)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          const ekgX = 148;
          const ekgY = 20;
          ctx.moveTo(ekgX, ekgY);
          ctx.lineTo(ekgX + 6, ekgY);
          ctx.lineTo(ekgX + 9, ekgY - 7 * beat);
          ctx.lineTo(ekgX + 13, ekgY + 6 * beat);
          ctx.lineTo(ekgX + 17, ekgY - 3 * beat);
          ctx.lineTo(ekgX + 20, ekgY);
          ctx.lineTo(ekgX + 28, ekgY);
          ctx.stroke();
          ctx.restore();
        }

        // Arms (Forearms & Biceps/Triceps/Cardio)
        const forearmColor = hasForearms ? secondaryColor : neutralColor;
        const forearmThick = exercise.name.toLowerCase().includes("hammer") ? 5.2 : 4.2;
        const armColCardio = hasChest || hasShouldersSec ? secondaryColor : neutralColor;

        if (isCardio) {
          if (!pose.frontView) {
            drawLimb(pose.shoulder, pose.elbowR, "#64748b", 3.8);
            drawLimb(pose.elbowR, pose.handR, "#64748b", 3.5);
          }
          drawLimb(
            pose.shoulder,
            pose.elbowL,
            armColCardio,
            4.2,
            secondaryColor,
            hasChest || hasShouldersSec ? 7 * c : 0
          );
          drawLimb(pose.elbowL, pose.handL, neutralColor, 3.8);

          if (pose.frontView) {
            drawLimb(
              pose.shoulder,
              pose.elbowR,
              armColCardio,
              4.2,
              secondaryColor,
              hasChest || hasShouldersSec ? 7 * c : 0
            );
            drawLimb(pose.elbowR, pose.handR, neutralColor, 3.8);
          }

          if (hasShouldersSec) {
            ctx.save();
            ctx.fillStyle = secondaryColor;
            ctx.shadowColor = secondaryColor;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(pose.shoulder[0], pose.shoulder[1], 4.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        } else {
          drawLimb(
            pose.elbowL,
            pose.handL,
            forearmColor,
            forearmThick,
            hasForearms ? secondaryColor : null,
            hasForearms ? 5 + 8 * c : 0
          );
          drawLimb(
            pose.elbowR,
            pose.handR,
            forearmColor,
            forearmThick,
            hasForearms ? secondaryColor : null,
            hasForearms ? 5 + 8 * c : 0
          );

          const upperArmColor = isBiceps ? primaryColor : hasShouldersSec ? secondaryColor : neutralColor;
          const upperArmThick = isBiceps ? 6.2 + 2.2 * c : 4.5;
          const armGlow = isBiceps ? 10 + 12 * c : 0;
          drawLimb(pose.shoulder, pose.elbowL, upperArmColor, upperArmThick, upperArmColor, armGlow);
          drawLimb(pose.shoulder, pose.elbowR, upperArmColor, upperArmThick, upperArmColor, armGlow);
        }

        // Biceps Peak Bulge (Tonjolan Otot Biceps saat Fleksi Siku)
        if (isBiceps) {
          const midArm = lerpPt(pose.shoulder, pose.elbowL, 0.55);
          const dx = pose.elbowL[0] - pose.shoulder[0];
          const dy = pose.elbowL[1] - pose.shoulder[1];
          const len = Math.hypot(dx, dy) || 1;
          const sideSign = exercise.name.toLowerCase().includes("chin-up") ? -1 : 1;
          const nx = (-dy / len) * sideSign;
          const ny = (dx / len) * sideSign;
          const bulgePos: [number, number] = [
            midArm[0] + nx * (2.5 + 3.5 * c),
            midArm[1] + ny * (2.5 + 3.5 * c),
          ];

          ctx.save();
          ctx.fillStyle = primaryColor;
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 12 + 10 * c;
          ctx.beginPath();
          ctx.arc(bulgePos[0], bulgePos[1], 3.2 + 3.2 * c, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Glowing ring pulse
          ctx.save();
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.25 + 0.55 * c})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(bulgePos[0], bulgePos[1], 6 + 5 * c, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 3. Draw Weight & Props in Front (Barbells, Dumbbells, Bands)
      pose.props.forEach((p) => {
        if (p.type === "band_front") {
          ctx.save();
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2.4 + p.tension * 1.6;
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 6 * p.tension;
          ctx.beginPath();
          ctx.moveTo(p.handL[0], p.handL[1]);
          ctx.lineTo(p.handR[0], p.handR[1]);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "dumbbells_pair") {
          [p.handL, p.handR].forEach((hPt) => {
            ctx.save();
            ctx.fillStyle = "#38bdf8";
            ctx.strokeStyle = "#e0f2fe";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(hPt[0] - 6, hPt[1] - 3, 12, 6, 2);
            } else {
              ctx.rect(hPt[0] - 6, hPt[1] - 3, 12, 6);
            }
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          });
        } else if (p.type === "dumbbell_side") {
          ctx.save();
          ctx.fillStyle = "#38bdf8";
          ctx.strokeStyle = "#e0f2fe";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "barbell_front") {
          ctx.save();
          const halfW = p.w / 2;
          ctx.strokeStyle = "#cbd5e1";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(110 - halfW - 10, p.y);
          ctx.lineTo(110 + halfW + 10, p.y);
          ctx.stroke();
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(110 - halfW - 6, p.y - 10, 5, 20);
          ctx.fillRect(110 + halfW + 1, p.y - 10, 5, 20);
          ctx.restore();
        } else if (p.type === "ez_bar_side") {
          ctx.save();
          ctx.fillStyle = "#38bdf8";
          ctx.strokeStyle = "#e0f2fe";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 7.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "band_under_feet") {
          ctx.save();
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2 + p.tension * 1.4;
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 5 * p.tension;
          ctx.beginPath();
          ctx.moveTo(p.handL[0], p.handL[1]);
          ctx.lineTo(p.footL[0], p.footL[1]);
          ctx.lineTo(p.footR[0], p.footR[1]);
          ctx.lineTo(p.handR[0], p.handR[1]);
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "barbell_side") {
          ctx.save();
          ctx.fillStyle = "#38bdf8";
          ctx.strokeStyle = "#0284c7";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r ?? 7.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#f8fafc";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === "dumbbell_horiz") {
          ctx.save();
          ctx.fillStyle = "#38bdf8";
          ctx.strokeStyle = "#e0f2fe";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else if (p.type === "dumbbell_vert") {
          ctx.save();
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - 7);
          ctx.lineTo(p.x, p.y + 7);
          ctx.stroke();
          ctx.fillStyle = "#38bdf8";
          ctx.fillRect(p.x - 4.5, p.y - 9, 9, 3.5);
          ctx.fillRect(p.x - 4.5, p.y + 5.5, 9, 3.5);
          ctx.restore();
        }
      });

      // Head
      ctx.save();
      ctx.fillStyle = "#0f172a";
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pose.head[0], pose.head[1], 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Jump Rope (Foreground pass when rope swings in front of body)
      pose.props.forEach((p) => {
        if (p.type === "jump_rope" && !p.behind) {
          ctx.save();
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 2.6;
          ctx.shadowColor = "#38bdf8";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(p.handL[0], p.handL[1]);
          ctx.quadraticCurveTo(100, p.peakY, p.handR[0], p.handR[1]);
          ctx.stroke();
          ctx.restore();
        }
      });

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };

    resize();
    window.addEventListener("resize", resize);
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [exercise, isPlaying, speed]);

  const isPeakContraction = contractionVal > 0.6;

  return (
    <div className={cn("flex flex-col rounded-xl overflow-hidden border border-slate-800 bg-slate-950", className)}>
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/80 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-200",
              isPeakContraction
                ? "bg-red-500/20 border-red-500/40 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                : "bg-slate-800 border-slate-700 text-slate-400"
            )}
          >
            {isPeakContraction ? "🔥 Puncak Kontraksi" : "Fase Gerakan"}
          </span>
          <span className="text-[11px] text-slate-400 capitalize hidden sm:inline">
            Otot Target: <span className="text-red-400 font-semibold">{exercise.primary_muscle || "Target"}</span>
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer"
            aria-label={isPlaying ? "Jeda animasi" : "Putar animasi"}
          >
            {isPlaying ? <Pause className="size-3 text-amber-400" /> : <Play className="size-3 text-emerald-400 fill-emerald-400" />}
            <span>{isPlaying ? "Jeda" : "Putar"}</span>
          </button>

          <div className="flex items-center rounded-md bg-slate-800/80 p-0.5 border border-slate-700/60">
            {([0.5, 1, 1.5] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSpeed(spd)}
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-semibold rounded transition cursor-pointer",
                  speed === spd ? "bg-red-600 text-white" : "text-slate-400 hover:text-white"
                )}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 60FPS High-Definition Canvas Viewport */}
      <div className={cn("relative w-full bg-slate-950 flex items-center justify-center overflow-hidden", heightClass)}>
        <canvas ref={canvasRef} className="size-full block" />

        {/* Subtle Watermark Badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-800 select-none pointer-events-none">
          <Sparkles className="size-3 text-red-400" />
          <span>Biomechanical Form Vector</span>
        </div>
      </div>

      {/* Legend & Guide Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-900/50 border-t border-slate-800/80 text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
            <span className="text-slate-300 font-medium">Otot Utama</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-400" />
            <span className="text-slate-300 font-medium">Otot Sekunder</span>
          </div>
        </div>
        <span className="text-slate-500 text-[10px]">Siklus repetisi ~1.5 detik</span>
      </div>
    </div>
  );
}
