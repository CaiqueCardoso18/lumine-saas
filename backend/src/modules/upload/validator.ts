import { z } from 'zod';

export const confirmUploadSchema = z.object({
  importId: z.string().min(1, 'importId obrigatório'),
});

export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
