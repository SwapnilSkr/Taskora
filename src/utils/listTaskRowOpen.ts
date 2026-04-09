import type React from "react";
import { useCallback, useRef } from "react";
import type { TaskDoc } from "../types/models";

const OVERLAY_JITTER_MS = 400;

/**
 * Radix portaled content still bubbles in React’s tree; stop it reaching `<tr onClick>`.
 */
export const listRowPortaledOverlayHandlers: {
  onPointerDown: React.PointerEventHandler<HTMLElement>;
  onClick: React.MouseEventHandler<HTMLElement>;
} = {
  onPointerDown(e) {
    e.stopPropagation();
  },
  onClick(e) {
    e.stopPropagation();
  },
};

/**
 * Row click opens details unless the target is inside `[data-row-action]`.
 * Put `data-row-action` only on the real control (button/input), not the whole `<td>` — fixed table
 * columns are wide, so empty cell space must stay “row” not “action”.
 */
export function useTaskRowClick(onTaskClick: (t: TaskDoc) => void) {
  const skipOpenUntil = useRef(0);

  const onOverlayClosed = useCallback(() => {
    skipOpenUntil.current = Date.now() + OVERLAY_JITTER_MS;
  }, []);

  const rowClick = useCallback(
    (task: TaskDoc) => (e: React.MouseEvent<HTMLTableRowElement>) => {
      if (e.button !== 0) return;
      const node = e.target;
      if (!(node instanceof Element)) return;
      if (node.closest("[data-row-action]")) return;
      if (Date.now() < skipOpenUntil.current) return;
      onTaskClick(task);
    },
    [onTaskClick],
  );

  return { rowClick, onOverlayClosed };
}
