import { Avatar, AvatarFallback } from "./ui/avatar";
import { cn } from "../lib/utils";

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function LeadAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={cn(className)}>
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
