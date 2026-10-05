import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

function ScoreSlider({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <View style={styles.sliderRow}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const selected = value === n;
        return (
          <TouchableOpacity
            key={n}
            style={[styles.scoreBtn, selected && styles.scoreBtnSelected]}
            onPress={() => onChange(n)}
            activeOpacity={0.75}
          >
            <Text style={[styles.scoreBtnText, selected && styles.scoreBtnTextSelected]}>
              {n}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function ScoreScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { submitScore, getScoreFor, isProjectComplete, projects, criteria } = useAuth();
  const router = useRouter();

  const id = Number(projectId);
  const project = projects.find((p) => p.id === id);

  if (!project) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {projectId ? 'Project not found.' : 'Select a project from the Projects tab to score it.'}
        </Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)' as any)} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back to Projects</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allScored = isProjectComplete(project.id);

  const handleSubmit = () => {
    if (!allScored) {
      Alert.alert('Incomplete', 'Please score all criteria before submitting.');
      return;
    }
    Alert.alert(
      'Scores Submitted',
      `Your scores for "${project.title}" have been recorded.`,
      [{ text: 'OK', onPress: () => router.push('/(tabs)' as any) }]
    );
  };

  const weightedTotal = () => {
    let total = 0;
    for (const c of criteria) {
      const s = getScoreFor(project.id, c.id);
      if (s === null) return null;
      total += s * c.weight;
    }
    return total.toFixed(2);
  };

  const total = weightedTotal();

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Project header */}
        <View style={styles.projectHeader}>
          <TouchableOpacity onPress={() => router.push('/(tabs)' as any)} style={styles.backLink}>
            <Ionicons name="chevron-back" size={16} color="#0277BD" />
            <Text style={styles.backLinkText}>Projects</Text>
          </TouchableOpacity>
          <Text style={styles.projectTitle}>{project.title}</Text>
          <Text style={styles.presenter}>{project.presenter} · {project.institution}</Text>
          <Text style={styles.description}>{project.description}</Text>
        </View>

        <Text style={styles.sectionLabel}>Scoring Rubric</Text>
        <Text style={styles.sectionNote}>Rate each criterion from 1 (poor) to 10 (excellent).</Text>

        {criteria.map((criterion) => {
          const score = getScoreFor(project.id, criterion.id);
          return (
            <View key={criterion.id} style={styles.criterionCard}>
              <View style={styles.criterionHeader}>
                <View style={styles.criterionMeta}>
                  <Text style={styles.criterionLabel}>{criterion.label}</Text>
                  <Text style={styles.criterionDesc}>{criterion.description}</Text>
                </View>
                <View style={styles.weightBadge}>
                  <Text style={styles.weightText}>{Math.round(criterion.weight * 100)}%</Text>
                </View>
              </View>
              <ScoreSlider
                value={score}
                onChange={(v) => submitScore(project.id, criterion.id, v)}
              />
              {score !== null && (
                <Text style={styles.scoreConfirm}>Selected: {score}/10</Text>
              )}
            </View>
          );
        })}

        {total !== null && (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Weighted Score</Text>
            <Text style={styles.totalValue}>{total} / 10</Text>
          </View>
        )}
      </ScrollView>

      {/* Submit pinned at bottom */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[styles.submitBtn, !allScored && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
        >
          <Ionicons
            name={allScored ? 'checkmark-circle' : 'lock-closed-outline'}
            size={18}
            color={allScored ? '#000' : '#90A4AE'}
          />
          <Text style={[styles.submitText, !allScored && styles.submitTextDisabled]}>
            {allScored ? 'Submit Scores' : 'Score all criteria to submit'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F0F4F8' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 16 },
  projectHeader: {
    backgroundColor: '#7DD3EA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  backLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backLinkText: { color: '#0277BD', fontSize: 13, fontWeight: '600' },
  projectTitle: { fontSize: 18, fontWeight: '800', color: '#000', lineHeight: 24 },
  presenter: { fontSize: 13, color: '#000', marginTop: 4, opacity: 0.7 },
  description: { fontSize: 13, color: '#000', marginTop: 10, lineHeight: 19, opacity: 0.8 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 4 },
  sectionNote: { fontSize: 12, color: '#546E7A', marginBottom: 14 },
  criterionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  criterionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  criterionMeta: { flex: 1 },
  criterionLabel: { fontSize: 15, fontWeight: '700', color: '#000' },
  criterionDesc: { fontSize: 12, color: '#546E7A', marginTop: 2 },
  weightBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B0BEC5',
  },
  weightText: { fontSize: 12, fontWeight: '700', color: '#0277BD' },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  scoreBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#B0BEC5',
  },
  scoreBtnSelected: {
    backgroundColor: '#7DD3EA',
    borderColor: '#000',
    borderWidth: 1.5,
  },
  scoreBtnText: { fontSize: 12, fontWeight: '600', color: '#546E7A' },
  scoreBtnTextSelected: { color: '#000', fontWeight: '800' },
  scoreConfirm: { fontSize: 11, color: '#546E7A', marginTop: 8, textAlign: 'right' },
  totalCard: {
    backgroundColor: '#7DD3EA',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  totalLabel: { fontSize: 14, fontWeight: '700', color: '#000' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#000' },
  submitContainer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: '#B0BEC5',
    backgroundColor: '#F0F4F8',
  },
  submitBtn: {
    backgroundColor: '#7DD3EA',
    borderRadius: 50,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  submitBtnDisabled: {
    backgroundColor: '#ECEFF1',
    borderColor: '#B0BEC5',
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#000' },
  submitTextDisabled: { color: '#90A4AE', fontSize: 14 },
  errorContainer: { flex: 1, backgroundColor: '#F0F4F8', justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorText: { color: '#546E7A', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  backBtn: { marginTop: 20 },
  backBtnText: { color: '#0277BD', fontSize: 14, fontWeight: '600' },
});