import { NextResponse } from 'next/server';
import { ApiKeyRepository } from '@/lib/db/repositories/apiKeys';

export async function DELETE(_request, { params }) {
  const { id } = await params;
  await ApiKeyRepository.delete(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(_request, { params }) {
  const { id } = await params;

  // The default key powered the 2.x chat builder's agentic tool-use loop, which
  // assumed cloud-provider reliability, so an Ollama key is never the default.
  // The rule stays with the chatbot factory gone (3.0.0) so saved keys keep
  // the flags they had; an Ollama key is still usable when named explicitly.
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
