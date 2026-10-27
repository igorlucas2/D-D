import { TablePresence } from './table-presence';

describe('TablePresence', () => {
  const campaign = 'c1';
  const ana = { userId: 'u-ana', displayName: 'Ana', role: 'player' as const };
  const mestre = {
    userId: 'u-mestre',
    displayName: 'Mestre',
    role: 'master' as const,
  };

  it('lista o mestre primeiro e os demais por nome', () => {
    const presence = new TablePresence();
    presence.join(campaign, 's1', ana);
    presence.join(campaign, 's2', {
      ...ana,
      userId: 'u-bia',
      displayName: 'Bia',
    });
    presence.join(campaign, 's3', mestre);
    expect(presence.list(campaign).map((m) => m.displayName)).toEqual([
      'Mestre',
      'Ana',
      'Bia',
    ]);
  });

  it('só marca ausente quando todas as abas do usuário estão ausentes', () => {
    const presence = new TablePresence();
    presence.join(campaign, 's1', ana);
    presence.join(campaign, 's2', ana);
    expect(presence.setStatus(campaign, ana.userId, 's1', 'away')).toBe(false);
    expect(presence.list(campaign)[0].status).toBe('online');
    expect(presence.setStatus(campaign, ana.userId, 's2', 'away')).toBe(true);
    expect(presence.list(campaign)[0].status).toBe('away');
  });

  it('remove o usuário quando a última aba fecha', () => {
    const presence = new TablePresence();
    presence.join(campaign, 's1', ana);
    presence.join(campaign, 's2', ana);
    expect(presence.leaveSocket('s1')).toEqual([campaign]);
    expect(presence.list(campaign)).toHaveLength(1);
    presence.leaveSocket('s2');
    expect(presence.list(campaign)).toEqual([]);
  });

  it('ignora status de aba que não entrou na campanha', () => {
    const presence = new TablePresence();
    presence.join(campaign, 's1', ana);
    expect(presence.setStatus(campaign, ana.userId, 'outra', 'away')).toBe(
      false,
    );
    expect(presence.setStatus('outra-campanha', ana.userId, 's1', 'away')).toBe(
      false,
    );
  });

  it('remove usuário e campanha inteira', () => {
    const presence = new TablePresence();
    presence.join(campaign, 's1', ana);
    presence.join(campaign, 's2', mestre);
    expect(presence.removeUser(campaign, ana.userId)).toBe(true);
    expect(presence.list(campaign).map((m) => m.userId)).toEqual([
      mestre.userId,
    ]);
    presence.removeCampaign(campaign);
    expect(presence.list(campaign)).toEqual([]);
  });
});
