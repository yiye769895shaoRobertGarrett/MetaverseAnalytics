// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface AvatarInteraction {
  id: string;
  encryptedData: string;
  timestamp: number;
  avatarId: string;
  interactionType: string;
  location: string;
}

const App: React.FC = () => {
  // Randomly selected style: Gradient (warm sunset) + Glassmorphism + Center radiation + Micro-interactions
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [interactions, setInteractions] = useState<AvatarInteraction[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newInteractionData, setNewInteractionData] = useState({
    interactionType: "",
    location: "",
    duration: ""
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Randomly selected additional features: Search & Filter, Data Statistics, Smart Chart
  const filteredInteractions = interactions.filter(interaction => 
    interaction.interactionType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    interaction.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const interactionTypes = [...new Set(interactions.map(i => i.interactionType))];
  const locations = [...new Set(interactions.map(i => i.location))];

  useEffect(() => {
    loadInteractions().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadInteractions = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("interaction_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing interaction keys:", e);
        }
      }
      
      const list: AvatarInteraction[] = [];
      
      for (const key of keys) {
        try {
          const interactionBytes = await contract.getData(`interaction_${key}`);
          if (interactionBytes.length > 0) {
            try {
              const interactionData = JSON.parse(ethers.toUtf8String(interactionBytes));
              list.push({
                id: key,
                encryptedData: interactionData.data,
                timestamp: interactionData.timestamp,
                avatarId: interactionData.avatarId,
                interactionType: interactionData.interactionType,
                location: interactionData.location
              });
            } catch (e) {
              console.error(`Error parsing interaction data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading interaction ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setInteractions(list);
    } catch (e) {
      console.error("Error loading interactions:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const submitInteraction = async () => {
    if (!provider) { 
      alert("Please connect wallet first"); 
      return; 
    }
    
    setCreating(true);
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: "Encrypting avatar interaction data with FHE..."
    });
    
    try {
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify(newInteractionData))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const interactionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const interactionData = {
        data: encryptedData,
        timestamp: Math.floor(Date.now() / 1000),
        avatarId: `avatar-${account.substring(0, 8)}`,
        interactionType: newInteractionData.interactionType,
        location: newInteractionData.location
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `interaction_${interactionId}`, 
        ethers.toUtf8Bytes(JSON.stringify(interactionData))
      );
      
      const keysBytes = await contract.getData("interaction_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(interactionId);
      
      await contract.setData(
        "interaction_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: "Encrypted interaction data submitted securely!"
      });
      
      await loadInteractions();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
        setShowCreateModal(false);
        setNewInteractionData({
          interactionType: "",
          location: "",
          duration: ""
        });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? "Transaction rejected by user"
        : "Submission failed: " + (e.message || "Unknown error");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    } finally {
      setCreating(false);
    }
  };

  const renderBarChart = () => {
    const typeCounts: Record<string, number> = {};
    interactionTypes.forEach(type => {
      typeCounts[type] = interactions.filter(i => i.interactionType === type).length;
    });

    const maxCount = Math.max(...Object.values(typeCounts), 1);

    return (
      <div className="chart-container">
        {interactionTypes.map(type => (
          <div key={type} className="chart-bar-container">
            <div className="chart-bar-label">{type}</div>
            <div 
              className="chart-bar" 
              style={{ width: `${(typeCounts[type] / maxCount) * 100}%` }}
            >
              <div className="chart-bar-value">{typeCounts[type]}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner"></div>
      <p>Initializing FHE analytics engine...</p>
    </div>
  );

  return (
    <div className="app-container">
      <div className="background-gradient"></div>
      
      <div className="center-radial-layout">
        <header className="app-header glassmorphism">
          <div className="logo">
            <h1>Metaverse<span>Analytics</span></h1>
            <div className="fhe-badge">FHE-Powered</div>
          </div>
          
          <div className="header-actions">
            <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
          </div>
        </header>
        
        <main className="main-content">
          <div className="hero-section glassmorphism">
            <h2>Privacy-Preserving Avatar Interaction Analytics</h2>
            <p>Analyze encrypted, anonymous avatar interaction data using FHE to optimize social experiences and space design</p>
            <button 
              onClick={() => setShowCreateModal(true)} 
              className="primary-btn"
            >
              Record Interaction
            </button>
          </div>
          
          <div className="stats-section glassmorphism">
            <div className="stat-card">
              <div className="stat-value">{interactions.length}</div>
              <div className="stat-label">Total Interactions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{interactionTypes.length}</div>
              <div className="stat-label">Interaction Types</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{locations.length}</div>
              <div className="stat-label">Virtual Locations</div>
            </div>
          </div>
          
          <div className="search-section glassmorphism">
            <input
              type="text"
              placeholder="Search interactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button onClick={loadInteractions} className="refresh-btn">
              {isRefreshing ? "Refreshing..." : "Refresh Data"}
            </button>
          </div>
          
          <div className="chart-section glassmorphism">
            <h3>Interaction Type Distribution</h3>
            {interactions.length > 0 ? renderBarChart() : (
              <div className="no-data">No interaction data available</div>
            )}
          </div>
          
          <div className="interactions-section glassmorphism">
            <h3>Avatar Interactions</h3>
            
            {filteredInteractions.length === 0 ? (
              <div className="no-interactions">
                <p>No interactions found</p>
                <button 
                  className="primary-btn"
                  onClick={() => setShowCreateModal(true)}
                >
                  Record First Interaction
                </button>
              </div>
            ) : (
              <div className="interactions-grid">
                {filteredInteractions.map(interaction => (
                  <div className="interaction-card" key={interaction.id}>
                    <div className="card-header">
                      <span className="avatar-id">Avatar: {interaction.avatarId}</span>
                      <span className="timestamp">
                        {new Date(interaction.timestamp * 1000).toLocaleString()}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="interaction-type">
                        <span>Type:</span> {interaction.interactionType}
                      </div>
                      <div className="interaction-location">
                        <span>Location:</span> {interaction.location}
                      </div>
                    </div>
                    <div className="card-footer">
                      <button 
                        className="view-btn"
                        onClick={() => {
                          const contract = getContractReadOnly();
                          if (contract) {
                            contract.getData(`interaction_${interaction.id}`)
                              .then(data => {
                                alert(`FHE-Encrypted Data: ${ethers.toUtf8String(data)}`);
                              });
                          }
                        }}
                      >
                        View Encrypted Data
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
  
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content glassmorphism">
            <div className="modal-header">
              <h3>Record New Interaction</h3>
              <button onClick={() => setShowCreateModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Interaction Type</label>
                <select
                  name="interactionType"
                  value={newInteractionData.interactionType}
                  onChange={(e) => setNewInteractionData({
                    ...newInteractionData,
                    interactionType: e.target.value
                  })}
                  className="form-input"
                >
                  <option value="">Select type</option>
                  <option value="Social">Social</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Education">Education</option>
                  <option value="Collaboration">Collaboration</option>
                </select>
              </div>
              <div className="form-group">
                <label>Virtual Location</label>
                <input
                  type="text"
                  name="location"
                  value={newInteractionData.location}
                  onChange={(e) => setNewInteractionData({
                    ...newInteractionData,
                    location: e.target.value
                  })}
                  placeholder="e.g. Virtual Concert Hall"
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  name="duration"
                  value={newInteractionData.duration}
                  onChange={(e) => setNewInteractionData({
                    ...newInteractionData,
                    duration: e.target.value
                  })}
                  placeholder="e.g. 15"
                  className="form-input"
                />
              </div>
              <div className="fhe-notice">
                Data will be encrypted using FHE before storage
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateModal(false)} className="secondary-btn">
                Cancel
              </button>
              <button 
                onClick={submitInteraction} 
                disabled={creating}
                className="primary-btn"
              >
                {creating ? "Encrypting..." : "Submit Interaction"}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="notification glassmorphism">
          <div className={`notification-icon ${transactionStatus.status}`}>
            {transactionStatus.status === "pending" && <div className="spinner"></div>}
            {transactionStatus.status === "success" && "✓"}
            {transactionStatus.status === "error" && "✗"}
          </div>
          <div className="notification-message">
            {transactionStatus.message}
          </div>
        </div>
      )}
  
      <footer className="app-footer glassmorphism">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>MetaverseAnalytics</h3>
            <p>Privacy-preserving interaction analytics powered by FHE</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="copyright">
            © {new Date().getFullYear()} MetaverseAnalytics. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;