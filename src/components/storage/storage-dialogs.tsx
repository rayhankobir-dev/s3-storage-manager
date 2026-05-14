"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, FolderPlus, Edit01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { CloseButton } from "@/components/base/buttons/close-button";
import { Input } from "@/components/base/input/input";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";

type ConfirmDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    isBusy?: boolean;
    onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
    isOpen,
    onOpenChange,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive,
    isBusy,
    onConfirm,
}: ConfirmDialogProps) {
    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
            <Modal>
                <Dialog>
                    <div className="relative w-full max-w-md rounded-2xl bg-primary p-6 shadow-xl ring-1 ring-secondary">
                        <CloseButton size="sm" className="absolute top-3 right-3" onClick={() => onOpenChange(false)} />
                        <div className="flex items-start gap-4">
                            <FeaturedIcon icon={AlertTriangle} color={destructive ? "error" : "warning"} theme="light" size="md" />
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold text-primary">{title}</h2>
                                <div className="mt-1 text-sm text-tertiary">{description}</div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-2">
                            <Button color="secondary" size="md" onClick={() => onOpenChange(false)} isDisabled={isBusy}>
                                {cancelLabel}
                            </Button>
                            <Button
                                color={destructive ? "primary-destructive" : "primary"}
                                size="md"
                                isLoading={isBusy}
                                onClick={() => void onConfirm()}
                            >
                                {confirmLabel}
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}

type TextDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    variant: "rename" | "create-folder";
    title: string;
    description: ReactNode;
    label: string;
    placeholder?: string;
    initialValue?: string;
    submitLabel: string;
    isBusy?: boolean;
    onSubmit: (value: string) => void | Promise<void>;
};

export function TextInputDialog({
    isOpen,
    onOpenChange,
    variant,
    title,
    description,
    label,
    placeholder,
    initialValue = "",
    submitLabel,
    isBusy,
    onSubmit,
}: TextDialogProps) {
    const [value, setValue] = useState(initialValue);

    // Reset value whenever the dialog is reopened with a different starting value.
    useEffect(() => {
        if (isOpen) setValue(initialValue);
    }, [isOpen, initialValue]);

    const trimmed = value.trim();
    const canSubmit = trimmed.length > 0 && trimmed !== initialValue.trim();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSubmit) return;
        await onSubmit(trimmed);
    }

    return (
        <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
            <Modal>
                <Dialog>
                    <form
                        onSubmit={handleSubmit}
                        className="relative w-full max-w-md rounded-2xl bg-primary p-6 shadow-xl ring-1 ring-secondary"
                    >
                        <CloseButton size="sm" className="absolute top-3 right-3" onClick={() => onOpenChange(false)} />
                        <div className="flex items-start gap-4">
                            <FeaturedIcon
                                icon={variant === "rename" ? Edit01 : FolderPlus}
                                color="brand"
                                theme="light"
                                size="md"
                            />
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold text-primary">{title}</h2>
                                <div className="mt-1 text-sm text-tertiary">{description}</div>
                            </div>
                        </div>

                        <div className="mt-5">
                            <Input
                                label={label}
                                placeholder={placeholder}
                                value={value}
                                onChange={setValue}
                                autoFocus
                                isRequired
                            />
                        </div>

                        <div className="mt-6 flex justify-end gap-2">
                            <Button type="button" color="secondary" size="md" onClick={() => onOpenChange(false)} isDisabled={isBusy}>
                                Cancel
                            </Button>
                            <Button type="submit" color="primary" size="md" isLoading={isBusy} isDisabled={!canSubmit}>
                                {submitLabel}
                            </Button>
                        </div>
                    </form>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
