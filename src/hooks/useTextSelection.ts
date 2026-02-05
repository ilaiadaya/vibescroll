"use client";

import { useState, useCallback, useEffect } from "react";

interface TextSelection {
  text: string;
  range: Range | null;
}

export function useTextSelection() {
  const [selection, setSelection] = useState<TextSelection>({
    text: "",
    range: null,
  });

  const handleSelectionChange = useCallback(() => {
    const windowSelection = window.getSelection();
    
    if (!windowSelection || windowSelection.isCollapsed) {
      setSelection({ text: "", range: null });
      return;
    }

    const selectedText = windowSelection.toString().trim();
    
    if (selectedText.length > 0 && selectedText.length < 200) {
      setSelection({
        text: selectedText,
        range: windowSelection.getRangeAt(0).cloneRange(),
      });
    } else {
      setSelection({ text: "", range: null });
    }
  }, []);

  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection({ text: "", range: null });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [handleSelectionChange]);

  return {
    selectedText: selection.text,
    hasSelection: selection.text.length > 0,
    clearSelection,
  };
}

