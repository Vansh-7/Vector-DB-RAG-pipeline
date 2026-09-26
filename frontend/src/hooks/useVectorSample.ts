import { useQuery } from "@tanstack/react-query";
import { getVectorSample } from "../api/vectors";
import { useAuthStore } from "../store/authStore";

export function useVectorSample() {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ["vectorSample", userId],
    queryFn: () => getVectorSample(2000),
    enabled: userId !== undefined,
  });
}
