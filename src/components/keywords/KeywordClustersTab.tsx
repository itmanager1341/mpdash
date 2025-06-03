
import ClusterTableView from "./ClusterTableView";

interface KeywordClustersTabProps {
  searchTerm: string;
}

const KeywordClustersTab = ({ searchTerm }: KeywordClustersTabProps) => {
  return <ClusterTableView searchTerm={searchTerm} />;
};

export default KeywordClustersTab;
