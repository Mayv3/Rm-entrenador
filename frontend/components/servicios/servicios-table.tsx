"use client";

import { useState } from "react";
import { Edit, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { GenericDataGrid } from "@/components/tables/DataGrid";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { GridColDef } from "@mui/x-data-grid";
import { useServicios, type Servicio } from "@/hooks/use-servicios";
import { AddServicioDialog } from "./add-servicio-dialog";
import { EditServicioDialog } from "./edit-servicio-dialog";
import { DeleteServicioDialog } from "./delete-servicio-dialog";

function firstSentence(html: string): string {
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  const match = text.match(/^[^.!?\n]+[.!?]?/)
  return match ? match[0].trim() : text.slice(0, 80)
}

function ServicioMobileCard({
  servicio,
  onEdit,
  onDelete,
}: {
  servicio: Servicio;
  onEdit: (s: Servicio) => void;
  onDelete: (s: Servicio) => void;
}) {
  return (
    <Card className="p-3 py-3 max-w-[90vw] mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: servicio.color ?? "#9e9e9e" }}
            />
            <CardTitle className="text-base">{servicio.nombre}</CardTitle>
          </div>
          <span className="font-semibold text-sm">${servicio.precio?.toLocaleString("es-AR")}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {servicio.descripcion && (
          <p className="text-sm text-muted-foreground text-start truncate">
            {firstSentence(servicio.descripcion)}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => onEdit(servicio)} variant="outline" className="flex-1">
            <Edit className="h-4 w-4" /> Editar
          </Button>
          <Button size="sm" onClick={() => onDelete(servicio)} variant="destructive" className="flex-1">
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ServiciosTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);

  const { data: servicios = [], isLoading } = useServicios();

  const filtered = servicios.filter(
    (s) =>
      s.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (servicio: Servicio) => { setSelectedServicio(servicio); setIsEditOpen(true); };
  const handleDelete = (servicio: Servicio) => { setSelectedServicio(servicio); setIsDeleteOpen(true); };

  const columns: GridColDef[] = [
    {
      field: "nombre", headerName: "Nombre", flex: 1, minWidth: 140,
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
      field: "precio", headerName: "Precio", flex: 0.7, minWidth: 90,
      renderCell: ({ value }) => `$${Number(value ?? 0).toLocaleString("es-AR")}`,
    },
    {
      field: "descripcion", headerName: "Descripción", flex: 1.5, minWidth: 120,
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
              <DropdownMenuItem onClick={() => handleEdit(row as Servicio)} className="text-blue-600 cursor-pointer">
                <Edit className="h-4 w-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(row as Servicio)} className="text-red-600 cursor-pointer">
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
            placeholder="Buscar servicios..."
            className="w-full pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="fixed bottom-24 right-4 w-16 h-16 rounded-full gap-1 bg-[var(--primary-color)] hover:bg-[var(--primary-color)] active:scale-90 md:active:scale-95 transition-transform duration-100 md:static md:h-10 md:w-[170px] md:py-2 md:rounded-md"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Nuevo Servicio</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:hidden">
            {filtered.map((servicio) => (
              <ServicioMobileCard
                key={servicio.id}
                servicio={servicio}
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

      <AddServicioDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
      {selectedServicio && (
        <>
          <EditServicioDialog open={isEditOpen} onOpenChange={setIsEditOpen} servicio={selectedServicio} />
          <DeleteServicioDialog
            open={isDeleteOpen}
            onOpenChange={setIsDeleteOpen}
            servicio={{ id: selectedServicio.id, nombre: selectedServicio.nombre }}
          />
        </>
      )}
    </>
  );
}
