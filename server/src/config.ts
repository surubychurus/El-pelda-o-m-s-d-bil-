import { z } from "zod";

export const roomConfigSchema = z.object({
  mode: z.enum(["classic", "teams"]),
  hunterCount: z.number().int().min(1).max(10),
  hunterPick: z.enum(["random", "manual"]),
  hunterId: z.string().uuid().nullable(),
  durationMin: z.number().int().min(5).max(480),
  waitMin: z.number().int().min(0).max(60),
  radiusM: z.number().int().min(50).max(5000),
  alertEveryMin: z.number().int().min(1).max(120),
  alertDurationSec: z.number().int().min(10).max(300),
  onCapture: z.enum(["eliminated", "hunter"]),
});

export type RoomConfig = z.infer<typeof roomConfigSchema>;

export const defaultConfig: RoomConfig = {
  mode: "classic",
  hunterCount: 2,
  hunterPick: "random",
  hunterId: null,
  durationMin: 60,
  waitMin: 5,
  radiusM: 500,
  alertEveryMin: 10,
  alertDurationSec: 60,
  onCapture: "eliminated",
};
