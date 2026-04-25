import { Building2, ChevronDown } from 'lucide-react';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { BranchInfo, GroupWithBranches } from '@/hooks/useRestaurantGroup';

interface Props {
  group: GroupWithBranches;
  selectedBranchId: string | null;
  onSelect: (id: string | null) => void;
}

export default function BranchSelector({ group, selectedBranchId, onSelect }: Props) {
  const current = group.branches.find((b: BranchInfo) => b.id === selectedBranchId);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <Building2 className="w-4 h-4" />
        <span className="hidden sm:inline">{group.name}</span>
        <ChevronDown className="w-3.5 h-3.5" />
      </div>
      <Select
        value={selectedBranchId ?? 'all'}
        onValueChange={(v) => onSelect(v === 'all' ? null : v)}
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue>
            {current ? `${current.name}${current.branch_code ? ` (${current.branch_code})` : ''}` : 'সকল শাখা'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">সকল শাখা</SelectItem>
          {group.branches.map((b: BranchInfo) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}{b.branch_code ? ` (${b.branch_code})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
