import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';

export default function SummaryScreen() {
  const { getProjectsForJudge, getScoreFor, isProjectComplete, criteria } = useAuth();
  const router = useRouter();

  const projects = getProjectsForJudge();
  const completedProjects = projects.filter((p) => isProjectComplete(p.id));
  const allDone = completedProjects.length === projects.length && projects.length > 0;

  const weightedScore = (projectId: number): string => {
    let total = 0;
    for (const c of criteria) {
      const s = getScoreFor(projectId, c.id);
      if (s === null) return '—';
      total += s * c.weight;
    }
    return total.toFixed(2);
  };

  return (
    <View style={styles.outer}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Status banner */}
        <View style={[styles.banner, allDone ? styles.bannerDone : styles.bannerPending]}>
          <Ionicons
            name={allDone ? 'checkmark-circle' : 'time-outline'}
            size={20}
            color={allDone ? '#2E7D32' : '#E65100'}
          />
          <Text style={[styles.bannerText, allDone ? styles.bannerTextDone : styles.bannerTextPending]}>
            {allDone
              ? `All ${projects.length} projects scored — you're done!`
              : `${completedProjects.length} of ${projects.length} projects scored`}
          </Text>
        </View>

        {projects.length === 0 ? (
          <Text style={styles.empty}>No projects assigned to your category.</Text>
        ) : (
          projects.map((project) => {
            const complete = isProjectComplete(project.id);
            const ws = weightedScore(project.id);
            return (
              <View key={project.id} style={[styles.card, !complete && styles.cardIncomplete]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.projectTitle} numberOfLines={1}>{project.title}</Text>
                  <Text style={[styles.ws, complete ? styles.wsDone : styles.wsEmpty]}>{ws}</Text>
                </View>
                <Text style={styles.presenter}>{project.presenter}</Text>

                <View style={styles.breakdown}>
                  {criteria.map((c) => {
                    const s = getScoreFor(project.id, c.id);
                    return (
                      <View key={c.id} style={styles.breakdownRow}>
                        <Text style={styles.criterionName}>{c.label}</Text>
                        <Text style={[styles.criterionScore, s === null && styles.criterionScoreEmpty]}>
                          {s !== null ? `${s}/10` : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => router.push(('/(tabs)/score?projectId=' + project.id) as any)}
                >
                  <Text style={styles.editBtnText}>
                    {complete ? 'Edit scores →' : 'Complete scoring →'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerLeft}>FairN²</Text>
        <Text style={styles.footerBrand}>
          <Text style={styles.footerHunter}>HUNTER</Text>
          <Text style={styles.footerWise}>wise</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#F0F4F8' },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 16, gap: 12 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
  },
  bannerDone: { backgroundColor: '#C8E6C9', borderColor: '#2E7D32' },
  bannerPending: { backgroundColor: '#FFE0B2', borderColor: '#E65100' },
  bannerText: { fontSize: 14, fontWeight: '600', flex: 1 },
  bannerTextDone: { color: '#2E7D32' },
  bannerTextPending: { color: '#E65100' },
  empty: { textAlign: 'center', color: '#90A4AE', marginTop: 60, fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  cardIncomplete: { borderColor: '#B0BEC5', opacity: 0.75 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  projectTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#000' },
  ws: { fontSize: 20, fontWeight: '800' },
  wsDone: { color: '#0277BD' },
  wsEmpty: { color: '#B0BEC5' },
  presenter: { fontSize: 12, color: '#546E7A', marginTop: 2, marginBottom: 10 },
  breakdown: { borderTopWidth: 1, borderTopColor: '#ECEFF1', paddingTop: 10, gap: 6 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  criterionName: { fontSize: 12, color: '#546E7A' },
  criterionScore: { fontSize: 13, fontWeight: '700', color: '#000' },
  criterionScoreEmpty: { color: '#B0BEC5' },
  editBtn: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#ECEFF1', paddingTop: 10 },
  editBtnText: { fontSize: 13, fontWeight: '600', color: '#0277BD' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#B0BEC5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#F0F4F8',
  },
  footerLeft: { fontSize: 13, fontWeight: '800', color: '#000' },
  footerBrand: { fontSize: 14 },
  footerHunter: { fontWeight: '700', color: '#000' },
  footerWise: { fontStyle: 'italic', color: '#0277BD' },
});