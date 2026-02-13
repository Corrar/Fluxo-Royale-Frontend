import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tag } from '@/types/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface TagInputProps {
  tags: Tag[];
  onChange: (tags: Tag[]) => void;
}

const tagColors = [
  { name: 'Cinza', value: 'bg-slate-500' },
  { name: 'Vermelho', value: 'bg-red-500' },
  { name: 'Laranja', value: 'bg-orange-500' },
  { name: 'Âmbar', value: 'bg-amber-500' },
  { name: 'Verde', value: 'bg-emerald-500' },
  { name: 'Azul', value: 'bg-blue-500' },
  { name: 'Roxo', value: 'bg-violet-500' },
  { name: 'Rosa', value: 'bg-pink-500' },
];

const generateId = () => Math.random().toString(36).substring(2, 9);

export const TagInput = ({ tags, onChange }: TagInputProps) => {
  const [newTagName, setNewTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(tagColors[0].value);
  const [isOpen, setIsOpen] = useState(false);

  const handleAddTag = () => {
    if (newTagName.trim() && tags.length < 10) {
      const newTag: Tag = {
        id: generateId(),
        name: newTagName.trim(),
        color: selectedColor,
      };
      onChange([...tags, newTag]);
      setNewTagName('');
      setSelectedColor(tagColors[0].value);
      setIsOpen(false);
    }
  };

  const handleRemoveTag = (id: string) => {
    onChange(tags.filter((tag) => tag.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="space-y-3">
      {/* Tags display */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white',
              'animate-scale-in transition-all duration-200 hover:scale-105',
              tag.color
            )}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemoveTag(tag.id)}
              className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
              aria-label={`Remover tag ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {tags.length < 10 && (
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
                  'border-2 border-dashed border-muted-foreground/30 text-muted-foreground',
                  'hover:border-primary hover:text-primary transition-colors duration-200'
                )}
              >
                <Plus className="h-3 w-3" />
                Tag
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 animate-scale-in" align="start">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Nome da tag..."
                    className="h-9"
                    maxLength={20}
                    autoFocus
                  />
                </div>
                
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Cor</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tagColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setSelectedColor(color.value)}
                        className={cn(
                          'w-6 h-6 rounded-full transition-all duration-200',
                          color.value,
                          selectedColor === color.value 
                            ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                            : 'hover:scale-110'
                        )}
                        aria-label={color.name}
                      />
                    ))}
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddTag}
                  disabled={!newTagName.trim()}
                  className="w-full"
                >
                  Adicionar Tag
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
};
