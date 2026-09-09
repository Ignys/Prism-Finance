drop policy if exists "transaction-attachment-files-update" on storage.objects;
create policy "transaction-attachment-files-update" on storage.objects
    for update to authenticated
    using (bucket_id = 'transaction-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'transaction-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
