"use client";

import { type DragEvent, useEffect, useMemo, useState } from "react";
import {
  Check,
  GripVertical,
  Minus,
  PackagePlus,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { getItemIcon, getRarityColor } from "@/lib/game-icons";
import { ITEM_CATEGORY_LABELS, translateItemCategory } from "@/lib/srd-labels";
import type { Character, InventoryItem, Item } from "@/lib/types";
import { useAuthStore } from "@/stores/auth-store";

interface InventoryTabProps {
  character: Character;
  onChange: (character: Character) => void;
}

type InventoryTarget = "equipped" | "backpack";

const ALL = "Todas";
const EQUIPMENT_FILTERS = ["Todos", "Equipados", "Mochila"];

const RARITY_LABELS: Record<string, string> = {
  COMMON: "Comum",
  UNCOMMON: "Incomum",
  RARE: "Rara",
  VERY_RARE: "Muito rara",
  LEGENDARY: "Lendaria",
  ARTIFACT: "Artefato",
};

const SLOT_LABELS: Record<string, string> = {
  HEAD: "Cabeca",
  CHEST: "Torso",
  LEGS: "Pernas",
  FEET: "Pes",
  HANDS: "Maos",
  MAIN_HAND: "Mao principal",
  OFF_HAND: "Mao secundaria",
  RING: "Anel",
  AMULET: "Amuleto",
  CLOAK: "Capa",
  NONE: "Sem slot",
};

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatRarity(value: string) {
  return RARITY_LABELS[value] ?? value;
}

function formatSlot(value: string) {
  return SLOT_LABELS[value] ?? value;
}

function parseProperties(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function matchesItemSearch(item: Item, search: string) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;
  const properties = parseProperties(item.properties).join(" ");
  return [
    item.name,
    item.category,
    item.rarity,
    item.slot,
    item.description ?? "",
    properties,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function FilterSelect({
  value,
  onChange,
  options,
  labels,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

export function InventoryTab({ character, onChange }: InventoryTabProps) {
  const token = useAuthStore((state) => state.token);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryCategory, setInventoryCategory] = useState(ALL);
  const [inventoryState, setInventoryState] = useState("Todos");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState(ALL);
  const [catalogRarity, setCatalogRarity] = useState(ALL);
  const [catalogSlot, setCatalogSlot] = useState(ALL);
  const [addQuantity, setAddQuantity] = useState(1);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<InventoryTarget | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inventory = useMemo(() => character.inventory ?? [], [character.inventory]);

  useEffect(() => {
    if (!token || !open || catalog.length > 0) return;
    api
      .get<Item[]>("/catalog/items", token)
      .then(setCatalog)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar o catalogo.");
      });
  }, [token, open, catalog.length]);

  async function refresh() {
    if (!token) return;
    const updated = await api.get<Character>(`/characters/${character.id}`, token);
    onChange(updated);
  }

  async function handleAdd(itemId: string) {
    if (!token) return;
    setError(null);
    setBusyId(itemId);
    try {
      await api.post(
        `/characters/${character.id}/inventory`,
        { itemId, quantity: addQuantity },
        token,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel adicionar o item.");
    } finally {
      setBusyId(null);
    }
  }

  async function setEquipped(item: InventoryItem, equipped: boolean) {
    if (!token || item.equipped === equipped) return;
    setError(null);
    setBusyId(item.id);
    try {
      await api.patch(
        `/characters/${character.id}/inventory/${item.id}`,
        { equipped },
        token,
      );
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel atualizar o item.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeQuantity(item: InventoryItem, delta: number) {
    if (!token) return;
    const quantity = Math.max(1, item.quantity + delta);
    if (quantity === item.quantity) return;
    setBusyId(item.id);
    try {
      await api.patch(`/characters/${character.id}/inventory/${item.id}`, { quantity }, token);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(item: InventoryItem) {
    if (!token) return;
    setBusyId(item.id);
    try {
      await api.delete(`/characters/${character.id}/inventory/${item.id}`, token);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  function handleDragStart(event: DragEvent<HTMLDivElement>, item: InventoryItem) {
    setDraggedId(item.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>, target: InventoryTarget) {
    event.preventDefault();
    const itemId = event.dataTransfer.getData("text/plain") || draggedId;
    const item = inventory.find((candidate) => candidate.id === itemId);
    setDraggedId(null);
    setDropTarget(null);
    if (!item) return;
    await setEquipped(item, target === "equipped");
  }

  const inventoryCategories = useMemo(() => {
    const unique = Array.from(new Set(inventory.map((entry) => entry.item.category))).sort();
    return [ALL, ...unique];
  }, [inventory]);

  const catalogCategories = useMemo(() => {
    const unique = Array.from(new Set(catalog.map((item) => item.category))).sort();
    return [ALL, ...unique];
  }, [catalog]);

  const catalogRarities = useMemo(() => {
    const unique = Array.from(new Set(catalog.map((item) => item.rarity))).sort();
    return [ALL, ...unique];
  }, [catalog]);

  const catalogSlots = useMemo(() => {
    const unique = Array.from(new Set(catalog.map((item) => item.slot))).sort();
    return [ALL, ...unique];
  }, [catalog]);

  const itemQuantities = useMemo(() => {
    const quantities = new Map<string, number>();
    inventory.forEach((entry) => {
      quantities.set(entry.itemId, (quantities.get(entry.itemId) ?? 0) + entry.quantity);
    });
    return quantities;
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory
      .filter((entry) => inventoryCategory === ALL || entry.item.category === inventoryCategory)
      .filter((entry) => {
        if (inventoryState === "Equipados") return entry.equipped;
        if (inventoryState === "Mochila") return !entry.equipped;
        return true;
      })
      .filter((entry) => matchesItemSearch(entry.item, inventorySearch))
      .sort((a, b) => Number(b.equipped) - Number(a.equipped) || a.item.name.localeCompare(b.item.name));
  }, [inventory, inventoryCategory, inventorySearch, inventoryState]);

  const filteredCatalog = useMemo(() => {
    return catalog
      .filter((item) => catalogCategory === ALL || item.category === catalogCategory)
      .filter((item) => catalogRarity === ALL || item.rarity === catalogRarity)
      .filter((item) => catalogSlot === ALL || item.slot === catalogSlot)
      .filter((item) => matchesItemSearch(item, catalogSearch));
  }, [catalog, catalogCategory, catalogRarity, catalogSearch, catalogSlot]);

  const equippedItems = filteredInventory.filter((entry) => entry.equipped);
  const backpackItems = filteredInventory.filter((entry) => !entry.equipped);
  const totalWeight = inventory.reduce(
    (sum, entry) => sum + entry.item.weight * entry.quantity,
    0,
  );
  const totalValue = inventory.reduce((sum, entry) => sum + entry.item.value * entry.quantity, 0);
  const equippedWeight = inventory
    .filter((entry) => entry.equipped)
    .reduce((sum, entry) => sum + entry.item.weight * entry.quantity, 0);

  function renderInventoryItem(entry: InventoryItem) {
    const ItemIcon = getItemIcon(entry.item.category);
    const properties = parseProperties(entry.item.properties);
    const disabled = busyId === entry.id;

    return (
      <div
        key={entry.id}
        draggable
        onDragStart={(event) => handleDragStart(event, entry)}
        onDragEnd={() => {
          setDraggedId(null);
          setDropTarget(null);
        }}
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 transition ${
          draggedId === entry.id ? "opacity-60" : ""
        }`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
          <ItemIcon className={`h-6 w-6 shrink-0 ${getRarityColor(entry.item.rarity)}`} />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {entry.item.name}
              {entry.equipped ? (
                <Badge variant="secondary" className="ml-2">
                  Equipado
                </Badge>
              ) : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {translateItemCategory(entry.item.category)} - {formatSlot(entry.item.slot)} - peso{" "}
              {formatNumber(entry.item.weight)}
            </p>
            {properties.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {properties.slice(0, 3).map((property) => (
                  <Badge key={property} variant="outline">
                    {property}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => changeQuantity(entry, -1)}
            disabled={disabled || entry.quantity <= 1}
            aria-label="Diminuir quantidade"
            title="Diminuir quantidade"
          >
            <Minus />
          </Button>
          <span className="w-8 text-center text-sm tabular-nums">{entry.quantity}</span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => changeQuantity(entry, 1)}
            disabled={disabled}
            aria-label="Aumentar quantidade"
            title="Aumentar quantidade"
          >
            <Plus />
          </Button>
          <Button
            variant={entry.equipped ? "secondary" : "outline"}
            size="sm"
            onClick={() => setEquipped(entry, !entry.equipped)}
            disabled={disabled}
          >
            <ShieldCheck />
            {entry.equipped ? "Desequipar" : "Equipar"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => removeItem(entry)}
            disabled={disabled}
            aria-label="Remover item"
            title="Remover item"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    );
  }

  function renderDropZone(target: InventoryTarget, title: string, items: InventoryItem[]) {
    const active = dropTarget === target;
    return (
      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDropTarget(target);
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(event) => void handleDrop(event, target)}
        className={`flex min-h-40 flex-col gap-2 rounded-lg border border-dashed px-3 py-3 transition ${
          active ? "border-primary bg-primary/5" : "border-border/60"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="outline">{items.length}</Badge>
        </div>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Arraste itens para esta area.
          </p>
        ) : (
          items.map(renderInventoryItem)
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">Peso total</p>
          <p className="text-lg font-semibold tabular-nums">{formatNumber(totalWeight)}</p>
        </div>
        <div className="rounded-lg border border-border/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">Peso equipado</p>
          <p className="text-lg font-semibold tabular-nums">{formatNumber(equippedWeight)}</p>
        </div>
        <div className="rounded-lg border border-border/60 px-3 py-2">
          <p className="text-xs text-muted-foreground">Valor estimado</p>
          <p className="text-lg font-semibold tabular-nums">{totalValue} po</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar no inventario..."
              value={inventorySearch}
              onChange={(event) => setInventorySearch(event.target.value)}
              className="w-56 pl-8"
            />
          </div>
          <FilterSelect
            ariaLabel="Filtrar categoria do inventario"
            value={inventoryCategory}
            onChange={setInventoryCategory}
            options={inventoryCategories}
            labels={{ ...ITEM_CATEGORY_LABELS, [ALL]: ALL }}
          />
          <FilterSelect
            ariaLabel="Filtrar estado do inventario"
            value={inventoryState}
            onChange={setInventoryState}
            options={EQUIPMENT_FILTERS}
          />
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <PackagePlus />
            Adicionar item
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Adicionar item</DialogTitle>
              <DialogDescription>
                Busque no catalogo global e adicione ao inventario do personagem.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar item..."
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  className="w-56 pl-8"
                />
              </div>
              <FilterSelect
                ariaLabel="Filtrar categoria do catalogo"
                value={catalogCategory}
                onChange={setCatalogCategory}
                options={catalogCategories}
                labels={{ ...ITEM_CATEGORY_LABELS, [ALL]: ALL }}
              />
              <FilterSelect
                ariaLabel="Filtrar raridade do catalogo"
                value={catalogRarity}
                onChange={setCatalogRarity}
                options={catalogRarities}
                labels={{ ...RARITY_LABELS, [ALL]: ALL }}
              />
              <FilterSelect
                ariaLabel="Filtrar slot do catalogo"
                value={catalogSlot}
                onChange={setCatalogSlot}
                options={catalogSlots}
                labels={{ ...SLOT_LABELS, [ALL]: ALL }}
              />
              <Input
                aria-label="Quantidade a adicionar"
                type="number"
                min={1}
                value={addQuantity}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setAddQuantity(Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1);
                }}
                className="w-24"
              />
            </div>

            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {filteredCatalog.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum item encontrado.
                </p>
              ) : (
                filteredCatalog.map((item) => {
                  const ItemIcon = getItemIcon(item.category);
                  const ownedQuantity = itemQuantities.get(item.id) ?? 0;
                  const disabled = busyId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ItemIcon className={`h-6 w-6 shrink-0 ${getRarityColor(item.rarity)}`} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {translateItemCategory(item.category)} - {formatRarity(item.rarity)} -{" "}
                            {formatSlot(item.slot)} - peso {formatNumber(item.weight)} - {item.value} po
                          </p>
                          {ownedQuantity > 0 ? (
                            <Badge variant="secondary" className="mt-1">
                              No inventario: {ownedQuantity}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleAdd(item.id)} disabled={disabled}>
                        {ownedQuantity > 0 ? <Plus /> : <Check />}
                        {ownedQuantity > 0 ? "Somar" : "Adicionar"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </DialogContent>
        </Dialog>
      </div>

      {error && !open ? <p className="text-sm text-destructive">{error}</p> : null}

      {inventory.length === 0 ? (
        <p className="rounded-lg border border-border/60 py-8 text-center text-sm text-muted-foreground">
          Nenhum item no inventario.
        </p>
      ) : filteredInventory.length === 0 ? (
        <p className="rounded-lg border border-border/60 py-8 text-center text-sm text-muted-foreground">
          Nenhum item corresponde aos filtros.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {renderDropZone("equipped", "Equipados", equippedItems)}
          {renderDropZone("backpack", "Mochila", backpackItems)}
        </div>
      )}
    </div>
  );
}
