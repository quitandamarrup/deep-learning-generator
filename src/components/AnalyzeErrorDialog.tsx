import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RotateCw } from "lucide-react";

export function AnalyzeErrorDialog({
  open,
  description,
  canRetry = true,
  onRetry,
  onCancel,
}: {
  open: boolean;
  description?: string;
  canRetry?: boolean;
  onRetry: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Maaf, analisis belum dapat diselesaikan.</DialogTitle>
          <DialogDescription>
            {description ??
              "Hal ini biasanya terjadi karena koneksi atau waktu respons layanan AI. Silakan coba kembali. Data CP yang sudah Anda isi tidak hilang."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Batal
          </Button>
          {canRetry && (
            <Button onClick={onRetry}>
              <RotateCw className="mr-2 h-4 w-4" />
              Coba Lagi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
