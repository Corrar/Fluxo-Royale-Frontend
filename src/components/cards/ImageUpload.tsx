import { useState, useRef } from 'react';
import { Upload, X, Link, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
}

export const ImageUpload = ({ value, onChange }: ImageUploadProps) => {
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput('');
    }
  };

  const handleRemove = () => {
    onChange(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (value) {
    return (
      <div className="relative rounded-xl overflow-hidden group animate-fade-in">
        <img 
          src={value} 
          alt="Preview" 
          className="w-full h-40 object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50%" y="50%" font-family="sans-serif" font-size="12" text-anchor="middle" dy=".3em" fill="%23999">Imagem inválida</text></svg>';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={handleRemove}
          className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upload' | 'url')} className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-9">
        <TabsTrigger value="upload" className="text-xs gap-1.5">
          <Upload className="h-3 w-3" />
          Upload
        </TabsTrigger>
        <TabsTrigger value="url" className="text-xs gap-1.5">
          <Link className="h-3 w-3" />
          URL
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-3">
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative rounded-xl border-2 border-dashed p-6 cursor-pointer transition-all duration-300',
            'flex flex-col items-center justify-center gap-3',
            'hover:border-primary hover:bg-primary/5',
            isDragging ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-muted-foreground/25'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className={cn(
            'p-3 rounded-full bg-muted transition-transform duration-300',
            isDragging && 'scale-110'
          )}>
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Arraste uma imagem ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, GIF até 10MB
            </p>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="url" className="mt-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Cole a URL da imagem..."
              className="pl-10"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUrlSubmit();
                }
              }}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim()}
          >
            Adicionar
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
};
