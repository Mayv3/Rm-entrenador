import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import axios from "axios";

export interface Servicio {
  id: number;
  nombre: string;
  precio: number;
  descripcion: string | null;
  color: string | null;
}

export function useServicios() {
  return useQuery<Servicio[]>({
    queryKey: queryKeys.servicios,
    queryFn: () =>
      axios.get(`${process.env.NEXT_PUBLIC_URL_BACKEND}/servicios`).then((r) => r.data),
    staleTime: Infinity,
  });
}
