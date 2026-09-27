<?php

namespace App\Notifications;

use App\Models\Item;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Emailed to a `DocumentUpload`'s uploader when `DocumentUploadListener`
 * rejects their file (M7 Story A4.2, #1906) — whether the cause was a bad
 * file (size/extension/MIME) or an unexpected error. Carries only a short,
 * generic reason, never an internal exception message.
 *
 * Pascal chose this mail-channel notification on 2026-09-26 (#1905) over an
 * in-panel database notification, which would have needed a `notifications`
 * table this app doesn't have — a second schema change beyond
 * `document_uploads`.
 */
class ItemDocumentUploadRejected extends Notification
{
    public function __construct(
        private readonly string $originalName,
        private readonly ?Item $item,
        private readonly string $reason,
    ) {}

    /**
     * @return array<int, string>
     */
    public function via(mixed $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        $itemLabel = $this->item->internal_name ?? $this->item->id ?? 'the item';

        return (new MailMessage)
            ->subject('Your document upload was not accepted')
            ->line(sprintf('Your upload "%s" for "%s" could not be processed.', $this->originalName, $itemLabel))
            ->line("Reason: {$this->reason}.")
            ->line('Please check the file and try uploading it again.');
    }
}
