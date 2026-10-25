import type { aftercareService } from "@/lib/aftercare/service";
import type { Serialized } from "@/features/leads/types";
export type Detail = Serialized<Awaited<ReturnType<ReturnType<typeof aftercareService>["detail"]>>>;
