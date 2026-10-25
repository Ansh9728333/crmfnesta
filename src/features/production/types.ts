import type { productionService } from "@/lib/production/service";
import type { Serialized } from "@/features/leads/types";
type Service = ReturnType<typeof productionService>;
export type LoadPlanning = Serialized<Awaited<ReturnType<Service["planning"]>>>;
export type LoadDetail = Serialized<Awaited<ReturnType<Service["detail"]>>>;
export type LoadList = Serialized<Awaited<ReturnType<Service["list"]>>>;
