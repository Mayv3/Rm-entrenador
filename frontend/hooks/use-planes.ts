import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import axios from "axios";

export interface Plan {
  id: number;
  nombre: string;
  precio: number;
  descripcion: string | null;
  color: string | null;
}

export function usePlanes() {
  return useQuery<Plan[]>({
    queryKey: queryKeys.planes,
    queryFn: () =>
      axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/planes`).then((r) => r.data),
    staleTime: Infinity,
  });
}

export function getPlanColor(planes: Plan[], nombre: string): string {
  return planes.find((p) => p.nombre === nombre)?.color ?? "#9e9e9e";
}
