import re
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'r', encoding='utf8') as f:
    code = f.read()

bad_str = r"return mediaLibrary.find\(\(  const subTabsMap: Record<string, \{ id: string; label: string \}\[\]> = \{"
good_str = '''return mediaLibrary.find((m) => m.id === clip.mediaId)?.type ?? null;
  }, [clip, mediaLibrary]);

  const isText = !!clip?.textSettings;
  const isAudio = mediaType === 'audio' || !!clip?.audioSettings;
  const category = initialTab || (isText ? 'text' : isAudio ? 'audio' : 'ai');
  const [subTab, setSubTab] = useState<string>('');

  const subTabsMap: Record<string, { id: string; label: string }[]> = {'''

code = re.sub(bad_str, good_str, code)
with open('src/mobile/components/MobilePropertiesSheet.tsx', 'w', encoding='utf8') as f:
    f.write(code)
