import { NextResponse } from 'next/server';
import { ApiKeyRepository } from '@/lib/db/repositories/apiKeys';

export async function DELETE(_request, { params }) {
  const { id } = await params;
  await ApiKeyRepository.delete(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(_request, { params }) {
  const { id } = await params;

  // An Ollama key is never the default (a rule from 2.x, kept so saved keys
  // keep the flags they had); it is still usable when named explicitly.
  const existing = await ApiKeyRepository.findById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }
  if (existing.provider === 'ollama') {
    return NextResponse.json(
      { error: 'Ollama keys cannot be the default key; name an Ollama key explicitly where it is used.' },
      { status: 400 }
    );
  }

  const updated = await ApiKeyRepository.setDefault(id);
  return NextResponse.json({
    key: updated && {
      id: updated.id,
      name: updated.name,
      provider: updated.provider,
      isDefault: updated.isDefault,
    },
  });
}
