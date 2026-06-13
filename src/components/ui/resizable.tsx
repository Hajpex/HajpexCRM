import { GripVertical, GripHorizontal } from "lucide-react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

type GroupProps = React.ComponentProps<typeof Group> & {
  orientation?: "horizontal" | "vertical";
};

const ResizablePanelGroup = ({
  className,
  orientation = "horizontal",
  ...props
}: GroupProps) => (
  <Group
    orientation={orientation}
    className={cn(
      "flex h-full w-full",
      orientation === "vertical" && "flex-col",
      className,
    )}
    {...props}
  />
);

const ResizablePanel = Panel;

type HandleProps = React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
  orientation?: "horizontal" | "vertical";
};

const ResizableHandle = ({
  withHandle,
  className,
  orientation,
  ...props
}: HandleProps) => (
  <Separator
    className={cn(
      "group/handle relative flex items-center justify-center bg-border/70 transition-colors hover:bg-primary/40 focus-visible:outline-none",
      orientation === "vertical" ? "h-px w-full" : "w-px self-stretch",
      className,
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-5 w-5 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground shadow-sm group-hover/handle:text-foreground">
        {orientation === "vertical" ? (
          <GripHorizontal className="h-3 w-3" />
        ) : (
          <GripVertical className="h-3 w-3" />
        )}
      </div>
    )}
  </Separator>
);

export { ResizablePanelGroup, ResizableHandle, ResizablePanel };
