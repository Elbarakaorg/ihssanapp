import { Check, ChevronDown, Flame, Search, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { display, palette, themedStyles, useScheme } from '@/ui/palette';

export function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  useScheme();
  return (
    <View style={styles.search}>
      <Search color={palette.muted} size={18} />
      <TextInput accessibilityLabel="Search cases" autoCapitalize="none" autoCorrect={false} maxLength={80} onChangeText={onChange} placeholder="Search by name, city or story" placeholderTextColor={palette.muted} returnKeyType="search" style={styles.searchInput} value={value} />
      {value ? <Pressable accessibilityLabel="Clear search" accessibilityRole="button" hitSlop={10} onPress={() => onChange('')}><X color={palette.muted} size={18} /></Pressable> : null}
    </View>
  );
}

export type Option = { value: string; label: string };
export type Group = { title?: string; options: Option[]; value: string; onSelect: (value: string) => void };

/** A compact dropdown trigger that opens a bottom sheet of options. */
export function Dropdown({ label, display: shown, active, groups }: { label: string; display: string; active: boolean; groups: Group[] }) {
  useScheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityHint={`Choose ${label.toLowerCase()}`} accessibilityLabel={`${label}: ${shown}`} accessibilityRole="button" onPress={() => setOpen(true)} style={({ pressed }) => [styles.trigger, active && styles.triggerActive, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={[styles.triggerText, active && styles.triggerTextActive]}>{shown}</Text>
        <ChevronDown color={active ? palette.forest : palette.muted} size={14} />
      </Pressable>
      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <Pressable accessibilityLabel="Close" onPress={() => setOpen(false)} style={styles.backdrop}>
          <Pressable style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView>
              {groups.map((group, index) => (
                <View key={group.title ?? index}>
                  {group.title ? <Text style={styles.groupTitle}>{group.title}</Text> : null}
                  {group.options.map((option) => {
                    const selected = group.value === option.value;
                    return (
                      <Pressable key={option.value} accessibilityRole="menuitem" accessibilityState={{ selected }} onPress={() => { group.onSelect(option.value); if (groups.length === 1) setOpen(false); }} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
                        <Text style={[styles.optionText, selected && styles.optionSelected]}>{option.label}</Text>
                        {selected ? <Check color={palette.forest} size={16} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            {groups.length > 1 ? <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.done}><Text style={styles.doneText}>Done</Text></Pressable> : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function ToggleChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  useScheme();
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="switch" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.trigger, selected && styles.triggerActive, pressed && styles.pressed]}>
      <Flame color={selected ? palette.forest : palette.muted} size={14} />
      <Text numberOfLines={1} style={[styles.triggerText, selected && styles.triggerTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  search: { alignItems: 'center', backgroundColor: palette.white, borderColor: palette.line, borderRadius: 26, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 50, paddingHorizontal: 16 },
  searchInput: { color: palette.ink, flex: 1, fontSize: 16, minHeight: 48, outlineStyle: 'none' } as object,
  trigger: { alignItems: 'center', backgroundColor: palette.glass, borderColor: palette.line, borderRadius: 18, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 4, justifyContent: 'center', minHeight: 38, paddingHorizontal: 10 },
  triggerActive: { backgroundColor: palette.leaf, borderColor: palette.leafDeep },
  triggerText: { color: palette.ink, flexShrink: 1, fontSize: 13, fontWeight: '600' },
  triggerTextActive: { color: palette.forest },
  pressed: { opacity: 0.85 },
  backdrop: { backgroundColor: 'rgba(20,40,28,0.45)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: palette.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', padding: 18, paddingBottom: 28 },
  sheetTitle: { ...display, color: palette.ink, fontSize: 20, marginBottom: 6 },
  groupTitle: { color: palette.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginTop: 12, textTransform: 'uppercase' },
  option: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 46 },
  optionText: { color: palette.ink, fontSize: 16 },
  optionSelected: { color: palette.forest, fontWeight: '700' },
  done: { alignItems: 'center', backgroundColor: palette.forest, borderRadius: 14, justifyContent: 'center', marginTop: 12, minHeight: 46 },
  doneText: { color: palette.white, fontSize: 15, fontWeight: '700' },
}));
