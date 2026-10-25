import type { commerceService } from "@/lib/commerce/service";
import type { Serialized } from "@/features/leads/types";
type Service = ReturnType<typeof commerceService>;
export type CommerceDetail = Serialized<Awaited<ReturnType<Service["detail"]>>>;
export type CommerceList = Serialized<Awaited<ReturnType<Service["list"]>>>;
