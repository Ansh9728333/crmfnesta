import type { orderService } from "@/lib/orders/service";
import type { Serialized } from "@/features/leads/types";
type Service = ReturnType<typeof orderService>;
export type OrderDetail = Serialized<Awaited<ReturnType<Service["detail"]>>>;
export type OrderStage = OrderDetail["stages"][number];
export type OrderList = Serialized<Awaited<ReturnType<Service["list"]>>>;
export type OrderConfiguration = Serialized<Awaited<ReturnType<Service["configuration"]>>>;
export type StageCommand = (action: string, data?: Record<string, unknown>) => Promise<void>;
