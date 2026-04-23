import { useState } from 'react';
import { Box, Card, CardContent, Stack, Typography, IconButton, CircularProgress, Divider, useTheme } from '@mui/material';
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { esES } from '@mui/x-data-grid/locales';

const localeTextES = {
  noRowsLabel: 'Sin registros',
  noResultsOverlayLabel: 'Sin resultados encontrados.',
  errorOverlayDefaultLabel: 'Ocurrió un error.',
  toolbarDensity: 'Densidad',
  toolbarDensityLabel: 'Densidad',
  toolbarDensityCompact: 'Compacta',
  toolbarDensityStandard: 'Estándar',
  toolbarDensityComfortable: 'Cómoda',
  toolbarColumns: 'Columnas',
  toolbarColumnsLabel: 'Seleccionar columnas',
  toolbarFilters: 'Filtros',
  toolbarFiltersLabel: 'Ver filtros',
  toolbarFiltersTooltipHide: 'Ocultar filtros',
  toolbarFiltersTooltipShow: 'Mostrar filtros',
  toolbarQuickFilterPlaceholder: 'Buscar…',
  toolbarQuickFilterLabel: 'Buscar',
  toolbarQuickFilterDeleteIconLabel: 'Limpiar',
  footerRowSelected: (count: number) =>
    count !== 1 ? `${count.toLocaleString()} filas seleccionadas` : `${count} fila seleccionada`,
  footerTotalRows: 'Filas Totales:',
  footerTotalVisibleRows: (visibleCount: number, totalCount: number) =>
    `${visibleCount.toLocaleString()} de ${totalCount.toLocaleString()}`,
  MuiTablePagination: {
    labelRowsPerPage: 'Filas por página:',
    labelDisplayedRows: ({ from, to, count }: any) =>
      `${from === 0 ? 0 : from}–${to} de ${count !== -1 ? count : `más de ${to}`}`,
  },
};

type GenericDataGridProps<T extends { id: string | number }> = {
  title?: string;
  rows: T[];
  columns: GridColDef[];
  paginationMode?: 'client' | 'server';
  rowCount?: number;
  page?: number;
  pageSize?: number;
  loading?: boolean;
  height?: number;
  initialSortModel?: Array<{ field: string; sort: 'asc' | 'desc' }>;
  onPaginationModelChange?: (model: GridPaginationModel) => void;
  columnVisibilityModel?: Record<string, boolean>;
  onRowClick?: (row: T) => void;
};

export function GenericDataGrid<T extends { id: string | number }>({
  rows,
  columns,
  paginationMode = 'client',
  rowCount,
  page = 0,
  pageSize = 10,
  onPaginationModelChange,
  loading = false,
  height = 600,
  initialSortModel = [{ field: 'nombre', sort: 'asc' }],
  columnVisibilityModel,
  onRowClick,
}: GenericDataGridProps<T>) {
  const theme = useTheme();
  const [mobilePage, setMobilePage] = useState(0);
  const mobilePageSize = 10;

  // Para vista móvil - calcular paginación
  const startIndex = mobilePage * mobilePageSize;
  const endIndex = startIndex + mobilePageSize;
  const paginatedRows = paginationMode === 'client'
    ? rows.slice(startIndex, endIndex)
    : rows;

  const totalPages = paginationMode === 'client'
    ? Math.ceil(rows.length / mobilePageSize)
    : Math.ceil((rowCount || 0) / pageSize);

  const handleMobilePageChange = (newPage: number) => {
    setMobilePage(newPage);
    if (paginationMode === 'server' && onPaginationModelChange) {
      onPaginationModelChange({ page: newPage, pageSize: mobilePageSize });
    }
  };

  return (
    <>
      {/* Vista Desktop - Tabla */}
      <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto', minHeight: 400 }}>
        <Box sx={{ width: '100%', height: '100%' }}>
          <DataGrid
            density="standard"
            sx={{
              backgroundColor: theme.palette.background.paper,
              height: '100%',
              minHeight: 400,
              fontSize: '0.8rem',
              '& .MuiDataGrid-main': { backgroundColor: theme.palette.background.paper },
              '& .MuiDataGrid-columnHeaders': { backgroundColor: theme.palette.background.paper },
              '& .MuiDataGrid-columnHeader': { backgroundColor: theme.palette.background.paper },
              '& .MuiDataGrid-columnHeadersInner': { backgroundColor: theme.palette.background.paper },
              '& .MuiDataGrid-virtualScroller': { backgroundColor: theme.palette.background.paper },
              '& .MuiDataGrid-footerContainer': { backgroundColor: theme.palette.background.paper },
              '& .MuiDataGrid-cell': {
                color: theme.palette.text.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              },
              ...(onRowClick && {
                '& .MuiDataGrid-row': { cursor: 'pointer' },
                '& .MuiDataGrid-row:hover': { backgroundColor: theme.palette.action.hover },
              }),
              '& .MuiDataGrid-columnHeaderTitle': { color: theme.palette.text.primary, fontWeight: 600 },
              '& .MuiDataGrid-columnHeader': { backgroundColor: theme.palette.background.paper },
              '& .MuiDataGrid-columnHeader .MuiDataGrid-columnHeaderTitleContainer': { justifyContent: 'center' },
            }}
            localeText={esES.components.MuiDataGrid.defaultProps.localeText}
            autoHeight={false}
            checkboxSelection={false}
            hideFooterSelectedRowCount
            rows={rows}
            columns={columns}
            {...(onRowClick && { onRowClick: (params) => onRowClick(params.row as T) })}
            {...(columnVisibilityModel && { columnVisibilityModel })}
            disableColumnResize
            disableColumnMenu
            paginationMode={paginationMode}
            {...(paginationMode === 'server' && {
              rowCount,
              paginationModel: { page: page!, pageSize: pageSize! },
              onPaginationModelChange,
              loading,
            })}
            {...(paginationMode === 'client' && {
              initialState: {
                sorting: { sortModel: initialSortModel },
                pagination: { paginationModel: { page: 0, pageSize: 15 } },
              },
            })}
            pageSizeOptions={[15]}
          />
        </Box>
      </Box>

      {/* Vista Móvil - Cards */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : paginatedRows.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">No hay registros para mostrar</Typography>
          </Box>
        ) : (
          <Stack spacing={2}>
            {paginatedRows.map((row: any) => (
              <Card key={row.id} variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 2,
                    mb: 2,
                    alignItems: 'start',
                    textAlign: 'left'
                  }}>
                    {columns
                      .filter(col => col.field !== 'acciones' && col.field !== 'id')
                      .map((col) => {
                        const value = row[col.field];
                        const cellContent = col.renderCell
                          ? col.renderCell({ row, value, field: col.field } as any)
                          : value;

                        return (
                          <Box key={col.field} sx={{ textAlign: 'left' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', textAlign: 'left' }}>
                              {col.headerName}
                            </Typography>
                            {col.field === 'color' ? (
                              <Box
                                sx={{
                                  mt: 0.5,
                                  height: 32,
                                  width: '100%',
                                  borderRadius: 1,
                                  backgroundColor: value || '#ccc',
                                }}
                              />
                            ) : (
                              <Typography component="div" variant="body2" sx={{ mt: 0.5, textAlign: 'left', wordBreak: 'break-word', width: '100%' }}>
                                {cellContent || '-'}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                  </Box>

                  {/* Acciones al final */}
                  {columns.find(col => col.field === 'acciones') && (
                    <>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{
                        '& > div': {
                          display: 'flex',
                          gap: 1,
                          width: '100%',
                        },
                        '& button, & a': {
                          flex: 1,
                          minHeight: 44,
                          borderRadius: 1,
                          fontWeight: 600,
                        },
                        '& button.MuiIconButton-colorPrimary': {
                          bgcolor: 'primary.main',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'primary.dark',
                          }
                        },
                        '& button.MuiIconButton-colorError': {
                          bgcolor: 'error.main',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'error.dark',
                          }
                        },
                        '& button.MuiIconButton-colorSuccess': {
                          bgcolor: 'success.main',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'success.dark',
                          }
                        },
                        '& button.MuiIconButton-colorInfo': {
                          bgcolor: 'info.main',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'info.dark',
                          }
                        },
                        '& button.MuiIconButton-colorWarning': {
                          bgcolor: 'warning.main',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'warning.dark',
                          }
                        }
                      }}>
                        {columns.find(col => col.field === 'acciones')?.renderCell?.({ row, value: null, field: 'acciones' } as any)}
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Paginación Mobile */}
            <Stack direction="row" spacing={1} sx={{ py: 2 }}>
              <Box
                onClick={() => mobilePage > 0 && handleMobilePageChange(mobilePage - 1)}
                sx={{
                  flex: 1,
                  py: 1.5,
                  px: 2,
                  bgcolor: mobilePage === 0 ? '#e0e0e0' : 'primary.main',
                  color: mobilePage === 0 ? 'text.disabled' : '#fff',
                  borderRadius: 2,
                  textAlign: 'center',
                  cursor: mobilePage === 0 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  '&:hover': {
                    opacity: mobilePage === 0 ? 1 : 0.9,
                    transform: mobilePage === 0 ? 'none' : 'translateY(-2px)',
                  }
                }}
              >
                <ChevronLeftIcon sx={{ fontSize: 20 }} />
                <Typography variant="body2" fontWeight={600}>
                  Anterior
                </Typography>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  py: 1.5,
                  px: 2,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  {mobilePage + 1} / {totalPages}
                </Typography>
              </Box>

              <Box
                onClick={() => mobilePage < totalPages - 1 && handleMobilePageChange(mobilePage + 1)}
                sx={{
                  flex: 1,
                  py: 1.5,
                  px: 2,
                  bgcolor: mobilePage >= totalPages - 1 ? '#e0e0e0' : 'primary.main',
                  color: mobilePage >= totalPages - 1 ? 'text.disabled' : '#fff',
                  borderRadius: 2,
                  textAlign: 'center',
                  cursor: mobilePage >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.5,
                  '&:hover': {
                    opacity: mobilePage >= totalPages - 1 ? 1 : 0.9,
                    transform: mobilePage >= totalPages - 1 ? 'none' : 'translateY(-2px)',
                  }
                }}
              >
                <Typography variant="body2" fontWeight={600}>
                  Siguiente
                </Typography>
                <ChevronRightIcon sx={{ fontSize: 20 }} />
              </Box>
            </Stack>
          </Stack>
        )}
      </Box>
    </>
  );
}
