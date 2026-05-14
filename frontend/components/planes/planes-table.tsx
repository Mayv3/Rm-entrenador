"use client";

import { useMemo, useState } from "react";
import { Edit, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { GenericDataGrid } from "@/components/tables/DataGrid";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GridColDef } from "@mui/x-data-grid";
import { usePlanes, type Plan } from "@/hooks/use-planes";
import { AddPlanDialog } from "./add-plan-dialog";
import { EditPlanDialog } from "./edit-plan-dialog";
import { DeletePlanDialog } from "./delete-plan-dialog";

function firstSentence(html: string): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  const match = text.match(/^[^.!?\n]+[.!?]?/)
  return match ? match[0].trim() : text.slice(0, 80)
}

function PlanMobileCard({
  plan,
  children,
  onEdit,
  onDelete,
}: {
  plan: Plan;
  children: Plan[];
  onEdit: (p: Plan) => void;
  onDelete: (p: Plan) => void;
}) {
  const sub3 = children.find((c) => c.duracion_meses === 3)
  const sub6 = children.find((c) => c.duracion_meses === 6)

  return (
    <Card className="p-3 py-3 max-w-[90vw] mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: plan.color ?? "#9e9e9e" }}
            />
            <CardTitle className="text-base">{plan.nombre}</CardTitle>
          </div>
          <span className="font-semibold text-sm">${plan.precio?.toLocaleString("es-AR")}/mes</span>
        </div>
        {(sub3 || sub6) && (
          <div className="flex gap-3 text-xs text-emerald-600 font-semibold mt-1">
            {sub3 && <span>3m (-{sub3.descuento}%): ${sub3.precio.toLocaleString("es-AR")}</span>}
            {sub6 && <span>6m (-{sub6.descuento}%): ${sub6.precio.toLocaleString("es-AR")}</span>}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {plan.descripcion && (
          <p className="text-sm text-muted-foreground text-start truncate">
            {firstSentence(plan.descripcion)}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => onEdit(plan)} variant="outline" className="flex-1">
            <Edit className="h-4 w-4" /> Editar
          </Button>
          <Button size="sm" onClick={() => onDelete(plan)} variant="destructive" className="flex-1">
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PlanesTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const { data: planes = [], isLoading } = usePlanes();

  const { basePlans, subplanMap } = useMemo(() => {
    const base = planes.filter((p) => p.parent_id == null)
    const map = new Map<number, Plan[]>()
    for (const p of planes) {
      if (p.parent_id != null) {
        if (!map.has(p.parent_id)) map.set(p.parent_id, [])
        map.get(p.parent_id)!.push(p)
      }
    }
    return { basePlans: base, subplanMap: map }
  }, [planes])

  const filtered = basePlans.filter(
    (p) =>
      p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (plan: Plan) => { setSelectedPlan(plan); setIsEditOpen(true); };
  const handleDelete = (plan: Plan) => { setSelectedPlan(plan); setIsDeleteOpen(true); };

  const columns: GridColDef[] = [
    {
      field: "nombre", headerName: "Nombre", flex: 1, minWidth: 120,
      renderCell: ({ value, row }) => (
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-[10px] h-[10px] rounded-full flex-shrink-0"
            style={{ backgroundColor: row.color ?? "#9e9e9e" }}
          />
          {value}
        </div>
      ),
    },
    {
      field: "precio", headerName: "Precio/mes", flex: 0.7, minWidth: 90,
      renderCell: ({ value }) => `$${value?.toLocaleString("es-AR")}`,
    },
    {
      field: "_3meses", headerName: "3 meses", flex: 0.8, minWidth: 110, sortable: false,
      renderCell: ({ row }) => {
        const sub = subplanMap.get(row.id)?.find((c) => c.duracion_meses === 3)
        return sub ? (
          <span className="text-emerald-600 font-medium">
            ${sub.precio.toLocaleString("es-AR")}
            <span className="text-xs text-muted-foreground ml-1">(-{sub.descuento}%)</span>
          </span>
        ) : "—"
      },
    },
    {
      field: "_6meses", headerName: "6 meses", flex: 0.8, minWidth: 110, sortable: false,
      renderCell: ({ row }) => {
        const sub = subplanMap.get(row.id)?.find((c) => c.duracion_meses === 6)
        return sub ? (
          <span className="text-emerald-600 font-medium">
            ${sub.precio.toLocaleString("es-AR")}
            <span className="text-xs text-muted-foreground ml-1">(-{sub.descuento}%)</span>
          </span>
        ) : "—"
      },
    },
    {
      field: "descripcion", headerName: "Descripción", flex: 1, minWidth: 100,
      renderCell: ({ value }) => value
        ? <span className="text-sm truncate">{firstSentence(value)}</span>
        : <span className="text-muted-foreground italic">—</span>,
    },
    {
      field: "acciones", headerName: "", width: 50, sortable: false,
      renderCell: ({ row }) => (
        <div className="flex items-center justify-center w-full h-full">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(row as Plan)} className="text-blue-600 cursor-pointer">
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(row as Plan)} className="text-red-600 cursor-pointer">
                <Trash2 className="h-4 w-4 mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar planes..."
            className="w-full pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="fixed bottom-24 right-4 w-16 h-16 rounded-full gap-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] active:scale-90 md:active:scale-95 transition-transform duration-100 md:static md:h-10 md:w-[150px] md:py-2 md:rounded-md"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Nuevo Plan</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {filtered.map((plan) => (
              <PlanMobileCard
                key={plan.id}
                plan={plan}
                children={subplanMap.get(plan.id) ?? []}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
          <div className="hidden md:block">
            <GenericDataGrid
              rows={filtered}
              columns={columns}
              initialSortModel={[{ field: "nombre", sort: "asc" }]}
            />
          </div>
        </>
      )}

      <AddPlanDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      {selectedPlan && (
        <>
          <EditPlanDialog open={isEditOpen} onOpenChange={setIsEditOpen} plan={selectedPlan} />
          <DeletePlanDialog
            open={isDeleteOpen}
            onOpenChange={setIsDeleteOpen}
            plan={{ id: selectedPlan.id, nombre: selectedPlan.nombre }}
          />
        </>
      )}
    </>
  );
}
