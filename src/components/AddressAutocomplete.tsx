import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { geocodeAddress, GeocodeCandidate } from '@/src/api/parking';
import { ApiError } from '@/src/api/client';
import { t, useLanguage } from '@/src/i18n';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;

interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (candidate: GeocodeCandidate) => void;
  placeholder?: string;
}

/** Live, as-you-type address search (debounced) with a dropdown of every
 * ambiguous match -- the same street name/number is often a real place in
 * several different Argentine cities, so the user picks the right one
 * instead of the backend silently guessing. Shared between searching for a
 * spot and publishing one. */
export function AddressAutocomplete({ value, onChangeText, onSelect, placeholder }: AddressAutocompleteProps) {
  useLanguage();
  const colors = useThemeColors();
  const [candidates, setCandidates] = useState<GeocodeCandidate[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `value` is controlled by the parent, which also overwrites it from
  // outside actual typing -- picking a suggestion (below) or, in the spot
  // publish form, resolving GPS to an address both write a finished string
  // straight into `value`. Re-searching those would be wasteful at best and
  // at worst reopens the dropdown right after the user just resolved an
  // exact location, risking they tap a *different* (merely similar) result
  // and silently swap out the coordinates they meant to keep. Only strings
  // that came out of this component's own onChangeText should trigger a
  // search; anything else is just a resync.
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value;
       
      setCandidates([]);
       
      setShowSuggestions(false);
       
      setError(null);
      return;
    }

    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setCandidates([]);
       
      setShowSuggestions(false);
       
      setError(null);
      return;
    }

    const timer = setTimeout(() => {
      setGeocoding(true);
      geocodeAddress(query)
        .then((results) => {
          setCandidates(results);
          setShowSuggestions(true);
          setError(results.length === 0 ? t('search.location.addressError') : null);
        })
        .catch((err) => {
          setCandidates([]);
          setShowSuggestions(true);
          setError(err instanceof ApiError ? err.detail : t('search.location.addressError'));
        })
        .finally(() => setGeocoding(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value]);

  function handleChangeText(text: string) {
    lastEmittedRef.current = text;
    onChangeText(text);
  }

  function handleSelect(candidate: GeocodeCandidate) {
    setShowSuggestions(false);
    setCandidates([]);
    onSelect(candidate);
  }

  const styles = StyleSheet.create({
    wrapper: { flex: 1, minWidth: 0, position: 'relative', zIndex: 20, elevation: 20 },
    inputWrapper: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 44,
    },
    input: { flex: 1, minWidth: 0, fontSize: 14, color: colors.text, height: '100%' },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      maxHeight: 320,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 12,
    },
    candidateRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    candidateMain: { flex: 1, minWidth: 0, fontSize: 14, color: colors.text, lineHeight: 19 },
    empty: { paddingVertical: 16, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputWrapper}>
        {geocoding ? (
          <ActivityIndicator color={colors.textSecondary} size="small" />
        ) : (
          <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
        )}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => candidates.length > 0 && setShowSuggestions(true)}
          // The delay lets a tap on a suggestion register before the list
          // disappears -- onBlur otherwise fires first and the FlatList
          // unmounts out from under the touch.
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          returnKeyType="search"
        />
      </View>

      {showSuggestions && (
        <View style={styles.dropdown}>
          {candidates.length > 0 ? (
            <FlatList
              data={candidates}
              keyExtractor={(item, index) => `${item.lat}-${item.lng}-${index}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.candidateRow} onPress={() => handleSelect(item)}>
                  <Ionicons name="location-outline" size={18} color={colors.teal} />
                  <Text style={styles.candidateMain} numberOfLines={2}>
                    {item.displayName}
                  </Text>
                </TouchableOpacity>
              )}
            />
          ) : (
            !geocoding && error && <Text style={styles.empty}>{error}</Text>
          )}
        </View>
      )}
    </View>
  );
}
