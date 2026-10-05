import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, Project } from '@/contexts/AuthContext';

function ProjectCard({
  project,
  complete,
  onPress,
}: {
  project: Project;
  complete: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitles}>
          <Text style={styles.projectTitle} numberOfLines={2}>
            {project.title}
          </Text>
          <Text style={styles.presenter}>
            {project.presenter} · {project.institution}
          </Text>
        </View>
        <View style={[styles.badge, complete ? styles.badgeDone : styles.badgePending]}>
          <Ionicons
            name={complete ? 'checkmark-circle' : 'ellipse-outline'}
            size={14}
            color={complete ? '#2E7D32' : '#546E7A'}
          />
          <Text style={[styles.badgeText, complete ? styles.badgeTextDone : styles.badgeTextPending]}>
            {complete ? 'Scored' : 'Pending'}
          </Text>
        </View>
      </View>
      <Text style={styles.description} numberOfLines={2}>
        {project.description}
      </Text>
      <View style={styles.cardFooter}>
        <Text style={styles.scoreCTA}>
          {complete ? 'Review / Edit scores →' : 'Tap to score →'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ProjectsScreen() {
  const { judge, getProjectsForJudge, isProjectComplete, logout } = useAuth();
  const router = useRouter();
  const projects = getProjectsForJudge();
  const completedCount = projects.filter((p) => isProjectComplete(p.id)).length;

  const handleLogout = () => {
    logout();
    router.replace('/login' as any);
  };

  const handleSelectProject = (project: Project) => {
    router.push(('/(tabs)/score?projectId=' + project.id) as any);
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-AU');

  return (
    <View style={styles.container}>
      {/* Header card */}
      <View style={styles.headerCard}>
        <View>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.judgeName}>{judge?.name}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.timeText}>{timeStr}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
      </View>

      {/* Category + progress */}
      <View style={styles.categorySection}>
        <Text style={styles.categoryLabel}>Your Category:</Text>
        <Text style={styles.categoryName}>{judge?.categoryName}</Text>
        <View style={styles.divider} />
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: projects.length > 0 ? `${(completedCount / projects.length) * 100}%` : '0%' },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>{completedCount}/{projects.length} scored</Text>
        </View>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            complete={isProjectComplete(item.id)}
            onPress={() => handleSelectProject(item)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No projects assigned to your category.</Text>
        }
      />

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
        <Text style={styles.footerBrand}>
          <Text style={styles.footerHunter}>HUNTER</Text>
          <Text style={styles.footerWise}>wise</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F4F8' },
  headerCard: {
    backgroundColor: '#7DD3EA',
    borderRadius: 16,
    margin: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  welcomeText: { fontSize: 28, fontWeight: '800', color: '#000' },
  judgeName: { fontSize: 18, fontWeight: '600', color: '#000', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  timeText: { fontSize: 14, fontWeight: '600', color: '#000' },
  dateText: { fontSize: 13, color: '#000', marginTop: 2 },
  categorySection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  categoryLabel: { fontSize: 15, color: '#455A64', marginBottom: 2 },
  categoryName: { fontSize: 20, fontWeight: '700', color: '#000', marginBottom: 6 },
  divider: { width: 120, height: 2, backgroundColor: '#000', marginBottom: 12 },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#B0BEC5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#0277BD', borderRadius: 3 },
  progressLabel: { fontSize: 12, color: '#455A64', fontWeight: '600', minWidth: 64 },
  list: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  cardTitles: { flex: 1 },
  projectTitle: { fontSize: 15, fontWeight: '700', color: '#000', lineHeight: 20 },
  presenter: { fontSize: 12, color: '#546E7A', marginTop: 3 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeDone: { backgroundColor: '#C8E6C9' },
  badgePending: { backgroundColor: '#ECEFF1', borderWidth: 1, borderColor: '#B0BEC5' },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeTextDone: { color: '#2E7D32' },
  badgeTextPending: { color: '#546E7A' },
  description: { fontSize: 13, color: '#546E7A', lineHeight: 18 },
  cardFooter: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#ECEFF1', paddingTop: 10 },
  scoreCTA: { fontSize: 13, fontWeight: '600', color: '#0277BD' },
  empty: { textAlign: 'center', color: '#90A4AE', marginTop: 60, fontSize: 14 },
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
  logoutBtn: {
    backgroundColor: '#7DD3EA',
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  logoutText: { fontSize: 14, fontWeight: '700', color: '#000' },
  footerBrand: { fontSize: 14 },
  footerHunter: { fontWeight: '700', color: '#000' },
  footerWise: { fontStyle: 'italic', color: '#0277BD' },
});
