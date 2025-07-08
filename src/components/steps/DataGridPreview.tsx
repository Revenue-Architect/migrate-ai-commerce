import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, AlertTriangle, CheckCircle } from 'lucide-react';

interface DataGridPreviewProps {
  data: any[];
  filename: string;
  maxRows?: number;
}

export const DataGridPreview = ({ data, filename, maxRows = 50 }: DataGridPreviewProps) => {
  const columnHelper = createColumnHelper<any>();
  
  const columns = useMemo(() => {
    if (!data.length) return [];
    
    return Object.keys(data[0]).map(key =>
      columnHelper.accessor(key, {
        id: key,
        header: key,
        cell: info => {
          const value = info.getValue();
          const displayValue = String(value || '');
          
          // Color code based on data type/content
          let className = "text-sm";
          if (!value || value === '') {
            className += " text-muted-foreground italic";
          } else if (typeof value === 'number' || /^\d+\.?\d*$/.test(displayValue)) {
            className += " text-blue-600 font-mono";
          } else if (displayValue.includes('@')) {
            className += " text-purple-600";
          } else if (!isNaN(Date.parse(displayValue)) && displayValue.includes('-')) {
            className += " text-green-600";
          }
          
          return (
            <div className={className} title={displayValue}>
              {displayValue || <span className="italic">empty</span>}
            </div>
          );
        },
      })
    );
  }, [data, columnHelper]);

  const table = useReactTable({
    data: data.slice(0, maxRows),
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const stats = useMemo(() => {
    const totalFields = Object.keys(data[0] || {}).length;
    const totalRecords = data.length;
    const emptyFields = Object.keys(data[0] || {}).reduce((count, field) => {
      const emptyCount = data.filter(row => !row[field] || row[field] === '').length;
      return count + (emptyCount > totalRecords * 0.5 ? 1 : 0);
    }, 0);
    
    return { totalFields, totalRecords, emptyFields };
  }, [data]);

  if (!data.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">No data to preview</p>
          <p className="text-muted-foreground">Upload a file to see your data here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Data Preview
            </div>
            <Badge variant="outline">{filename}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">{stats.totalRecords} records</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="text-sm">{stats.totalFields} fields</span>
            </div>
            {stats.emptyFields > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm">{stats.emptyFields} sparse fields</span>
              </div>
            )}
          </div>
          
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="bg-muted/50 border-b sticky top-0">
                  {table.getHeaderGroups().map(headerGroup => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map(header => (
                        <th
                          key={header.id}
                          className="text-left p-3 font-medium text-sm min-w-32 border-r last:border-r-0"
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map(row => (
                    <tr key={row.id} className="border-b hover:bg-muted/25">
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className="p-3 border-r last:border-r-0 max-w-48 truncate">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {data.length > maxRows && (
            <div className="mt-2 text-sm text-muted-foreground text-center">
              Showing first {maxRows} of {data.length} records
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};