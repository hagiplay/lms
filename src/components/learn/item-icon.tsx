import { FileText, HelpCircle, ListChecks, PlayCircle } from "lucide-react";
import type { ItemType } from "@/lib/domain/types";

export const itemTypeLabel: Record<ItemType, string> = { video: "שיעור וידאו", text: "קריאה", quiz: "מבדק", assignment: "משימה" };
const icons = { video: PlayCircle, text: FileText, quiz: HelpCircle, assignment: ListChecks };

export function ItemIcon({ type, size = 18, className }: { type: ItemType; size?: number; className?: string }) {
  const Icon = icons[type];
  return <Icon aria-label={itemTypeLabel[type]} size={size} className={className} />;
}
