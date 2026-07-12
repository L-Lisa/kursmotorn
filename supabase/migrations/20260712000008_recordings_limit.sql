-- Kursmotorn v1 — fas 4: höj recordings-bucketens filstorleksgräns för riktiga MP4-inspelningar.
-- Motorns särskiljare (benchmarken): marknaden kapar vid 10–100 MB; vi tillåter stora filer via TUS.
-- Teknisk maxgräns = konfig (2 GB). Endast video tillåts i bucketen.
update storage.buckets
set file_size_limit = 2147483648,  -- 2 GB
    allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm']
where id = 'recordings';
