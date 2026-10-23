import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

const MAX_COMMENT = 2000;

// Turns an API error into a title + message a judge can act on
function describeError(err: any, action: string): [string, string] {
  if (err?.code === 'JUDGING_CLOSED') {
    return ['Judging has closed', 'Scores and comments can no longer be changed. Thanks for judging!'];
  }
  return [`${action} failed`, err?.message || 'Something went wrong. Please try again.'];
}

function ScoreSlider({ value, max, onChange }: { value: number | null; max: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.sliderRow}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
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
  const {
    submitScore, saveComment, verifyProjectSaved,
    getScoreFor, isProjectComplete, projects, criteria,
  } = useAuth();
  const router = useRouter();

  const id = Number(projectId);
  const project = projects.find((p) => p.id === id);

  // The Score tab is reused for every project, so reload the comment box
  // whenever a different project is opened.
  const [comment, setComment] = useState(project?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    setComment(project?.comment ?? '');
  }, [id]);

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

  const handleScore = (criterionId: number, value: number) => {
    submitScore(project.id, criterionId, value).catch((err) => {
      const [title, message] = describeError(err, 'Saving that score');
      Alert.alert(title, err?.code === 'JUDGING_CLOSED' ? message : `${message}\n\nPlease tap the score again.`);
    });
  };

  const handleSubmit = async () => {
    if (!allScored) {
      Alert.alert('Incomplete', 'Please answer every question before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      if (comment.trim() !== (project.comment ?? '')) {
        await saveComment(project.id, comment);
      }
      // Only tell the judge it worked once the server confirms every score
      const saved = await verifyProjectSaved(project.id);
      if (!saved) {
        Alert.alert(
          'Some scores did not save',
          'The screen now shows what the server has. Please re-check your scores and tap Submit again.'
        );
        return;
      }
      Alert.alert(
        'Scores Submitted',
        `Your scores for "${project.title}" have been saved.`,
        [{ text: 'OK', onPress: () => router.push('/(tabs)' as any) }]
      );
    } catch (err) {
      const [title, message] = describeError(err, 'Submitting');
      Alert.alert(title, message);
    } finally {
      setSubmitting(false);
    }
  };

  // Rubric total: plain sum of the question scores (e.g. out of 30)
  const maxTotal = criteria.reduce((sum, c) => sum + c.max_score, 0);
  const maxPerQuestion = criteria.length ? Math.max(...criteria.map((c) => c.max_score)) : 5;
  const runningTotal = () => {
    let total = 0;
    for (const c of criteria) {
      const s = getScoreFor(project.id, c.id);
      if (s === null) return null;
      total += s;
    }
    return total;
  };

  const total = runningTotal();

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
        <Text style={styles.sectionNote}>
          Rate each question from 1 (lowest) to {maxPerQuestion} (highest).
        </Text>

        {criteria.map((criterion, index) => {
          const score = getScoreFor(project.id, criterion.id);
          return (
            <View key={criterion.id} style={styles.criterionCard}>
              <View style={styles.criterionHeader}>
                <View style={styles.criterionMeta}>
                  <Text style={styles.questionTag}>Q{index + 1} · {criterion.label}</Text>
                  <Text style={styles.questionText}>{criterion.description}</Text>
                </View>
              </View>
              <ScoreSlider
                value={score}
                max={criterion.max_score}
                onChange={(v) => handleScore(criterion.id, v)}
              />
              <View style={styles.scaleHints}>
                <Text style={styles.scaleHint}>1 = {criterion.low_label || 'lowest'}</Text>
                <Text style={styles.scaleHint}>{criterion.max_score} = highest</Text>
              </View>
              {score !== null && (
                <Text style={styles.scoreConfirm}>Selected: {score}/{criterion.max_score}</Text>
              )}
            </View>
          );
        })}

        {/* Written feedback */}
        <View style={styles.commentCard}>
          <Text style={styles.criterionLabel}>Comments <Text style={styles.optional}>(optional)</Text></Text>
          <Text style={styles.criterionDesc}>
            Strengths, suggestions, or anything that stood out. Organisers may use these when announcing winners.
          </Text>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="e.g. Great prototype and clear survey results…"
            placeholderTextColor="#90A4AE"
            multiline
            maxLength={MAX_COMMENT}
            textAlignVertical="top"
            editable={!submitting}
          />
          <Text style={styles.charCount}>{comment.length}/{MAX_COMMENT}</Text>
        </View>

        {total !== null && (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Score</Text>
            <Text style={styles.totalValue}>{total} / {maxTotal}</Text>
          </View>
        )}
      </ScrollView>

      {/* Submit pinned at bottom */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[styles.submitBtn, !allScored && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Ionicons
              name={allScored ? 'checkmark-circle' : 'lock-closed-outline'}
              size={18}
              color={allScored ? '#000' : '#90A4AE'}
            />
          )}
          <Text style={[styles.submitText, !allScored && styles.submitTextDisabled]}>
            {submitting ? 'Saving…' : allScored ? 'Submit Scores' : 'Answer every question to submit'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  questionTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0277BD',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  questionText: { fontSize: 15, fontWeight: '700', color: '#000', lineHeight: 21 },
  scaleHints: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, gap: 8 },
  scaleHint: { fontSize: 11, color: '#546E7A', flexShrink: 1 },
  criterionDesc: { fontSize: 12, color: '#546E7A', marginTop: 2 },
  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  scoreBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
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
  scoreBtnText: { fontSize: 18, fontWeight: '700', color: '#546E7A' },
  scoreBtnTextSelected: { color: '#000', fontWeight: '800' },
  scoreConfirm: { fontSize: 11, color: '#546E7A', marginTop: 8, textAlign: 'right' },
  commentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  optional: { fontSize: 12, fontWeight: '400', color: '#546E7A' },
  commentInput: {
    marginTop: 10,
    minHeight: 110,
    borderWidth: 1,
    borderColor: '#B0BEC5',
    borderRadius: 8,
    backgroundColor: '#F0F4F8',
    padding: 10,
    fontSize: 14,
    color: '#000',
  },
  charCount: { fontSize: 11, color: '#90A4AE', marginTop: 6, textAlign: 'right' },
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