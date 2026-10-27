import type { HpSnapshot } from '../combat/combat-action.types';

export interface MechanicalFacts {
  action: string;
  outcome: string;
  targets: Array<{ name: string; result: string }>;
  resource: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hp(value: unknown): HpSnapshot | null {
  const data = record(value);
  if (
    !data ||
    typeof data.current !== 'number' ||
    typeof data.max !== 'number' ||
    typeof data.temp !== 'number'
  )
    return null;
  return { current: data.current, max: data.max, temp: data.temp };
}

function hpText(value: unknown): string {
  const snapshot = hp(value);
  return snapshot ? `PV ${snapshot.current}/${snapshot.max}` : 'PV não exposto';
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

/**
 * Transforma o resultado persistido de uma ação mecânica em fatos curtos para
 * a narração. O modelo recebe apenas o que o motor já aplicou.
 */
export function describeMechanicalResult(
  kind: string,
  result: unknown,
): MechanicalFacts {
  const data = record(result);

  if (kind === 'USE_ITEM' && data) {
    const item = record(data.item);
    const name = typeof item?.name === 'string' ? item.name : 'Item';
    const effect =
      data.effectKind === 'HEAL'
        ? 'cura'
        : data.effectKind === 'TEMP_HP'
          ? 'PV temporário'
          : 'dano';
    const itemTarget = record(data.target);
    return {
      action: `Uso de ${name}`,
      outcome: `${effect} aplicada pelo motor`,
      targets: [
        {
          name:
            itemTarget && typeof itemTarget.name === 'string'
              ? itemTarget.name
              : 'Personagem',
          result: `${numberValue(data.applied)} de ${effect} · ${hpText(data.hpAfter)} · restam ${numberValue(item?.quantityAfter)}`,
        },
      ],
      resource: `item ${name}`,
    };
  }

  if (kind === 'WEAPON_ATTACK' && data) {
    const weapon = record(data.weapon);
    const name = typeof weapon?.name === 'string' ? weapon.name : 'Arma';
    const target = record(data.target);
    const attack = record(data.attack);
    const damage = record(data.damage);
    const outcome = attack?.hit
      ? attack.critical
        ? 'crítico'
        : 'acertou'
      : 'errou';
    return {
      action: `Ataque com ${name}`,
      outcome: 'ataque resolvido pelo motor',
      targets: [
        {
          name:
            target && typeof target.name === 'string' ? target.name : 'Alvo',
          result: `${outcome} (${numberValue(attack?.total)} vs CA ${numberValue(attack?.ac)}) · ${numberValue(data.applied)} de dano${typeof damage?.damageType === 'string' ? ` ${damage.damageType}` : ''} · ${hpText(data.hpAfter)}`,
        },
      ],
      resource: `arma ${name}`,
    };
  }

  if (kind === 'CAST_SPELL' && data) {
    const spell = record(data.spell);
    const name = typeof spell?.name === 'string' ? spell.name : 'Magia';
    const slot = record(data.slot);
    const targets = Array.isArray(data.targets) ? data.targets : [];
    const details = targets
      .map((raw) => record(raw))
      .filter((entry): entry is Record<string, unknown> => Boolean(entry))
      .map((target) => {
        const targetName =
          typeof target.name === 'string' ? target.name : 'Alvo';
        if (record(target.attack)) {
          const attack = record(target.attack)!;
          const outcome = attack.hit
            ? attack.critical
              ? 'crítico'
              : 'acertou'
            : 'errou';
          return {
            name: targetName,
            result: `${outcome} (${numberValue(attack.total)} vs CA ${numberValue(attack.ac)}) · ${numberValue(target.applied)} de dano · ${hpText(target.hpAfter)}`,
          };
        }
        if (record(target.save)) {
          const save = record(target.save)!;
          return {
            name: targetName,
            result: `${save.success ? 'passou' : 'falhou'} no save (${numberValue(save.total)} vs CD ${numberValue(save.dc)}) · ${numberValue(target.applied)} de dano · ${hpText(target.hpAfter)}`,
          };
        }
        return {
          name: targetName,
          result: `${numberValue(target.applied)} de cura · ${hpText(target.hpAfter)}`,
        };
      });
    return {
      action: name,
      outcome: 'conjuração resolvida pelo motor',
      targets: details.length
        ? details
        : [{ name: 'Mesa', result: 'sem alvos registrados' }],
      resource: slot
        ? `espaço de magia nível ${numberValue(slot.level)}`
        : 'truque, sem espaço',
    };
  }

  const target = data ? record(data.target) : null;
  const targetName =
    target && typeof target.name === 'string' ? target.name : 'Alvo';
  const conditionText = Array.isArray(data?.conditionsAfter)
    ? data.conditionsAfter.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];
  const effect =
    kind === 'DAMAGE'
      ? `${numberValue(data?.applied)} de dano`
      : kind === 'HEAL'
        ? `${numberValue(data?.applied)} de cura`
        : kind === 'TEMP_HP'
          ? `${numberValue(data?.applied)} de PV temporário`
          : conditionText.length
            ? `condições: ${conditionText.join(', ')}`
            : 'condição atualizada';
  return {
    action:
      kind === 'DAMAGE'
        ? 'Dano'
        : kind === 'HEAL'
          ? 'Cura'
          : kind === 'TEMP_HP'
            ? 'PV temporário'
            : 'Condição',
    outcome: 'efeito aplicado pelo motor',
    targets: [
      {
        name: targetName,
        result: `${effect}${data?.hpAfter ? ` · ${hpText(data.hpAfter)}` : ''}`,
      },
    ],
    resource: null,
  };
}
