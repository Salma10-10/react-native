import React, { useState } from "react";
import { StyleSheet, Button, View, FlatList, Text } from "react-native";

export default function TabTwoScreen() {
  interface DataItem {
    id: string;
    original_text: string;
    translated_text: string;
    language: string;
    model: string;
  }

  const [translations, setTranslations] = useState<DataItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchTranslations = async () => {
    try {
      const response = await fetch(
        "http://192.168.0.199:3000/api/get-translations"
      );
      if (!response.ok) {
        throw new Error("Failed to fetch translations");
      }
      const data = await response.json();
      setTranslations(data);
    } catch (error) {
      console.error("Error fetching translations:", error);
      setError("Failed to fetch translations");
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Fetch Translations" onPress={fetchTranslations} />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <FlatList
        data={translations}
        keyExtractor={(item) => item.id}
        numColumns={1} // Set the number of columns for the grid
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <Text style={styles.gridText}>
              <Text style={{ fontWeight: "bold", fontSize: 15 }}>
                Original Text:
              </Text>{" "}
              {item.original_text}
            </Text>
            <Text style={styles.gridText}>
              <Text style={{ fontWeight: "bold", fontSize: 15 }}>
                Translated Text:
              </Text>{" "}
              {item.translated_text}
            </Text>
            <Text style={styles.gridText}>
              <Text style={{ fontWeight: "bold", fontSize: 15 }}>
                Language:
              </Text>{" "}
              {item.language}
            </Text>
            <Text style={styles.gridText}>
              <Text style={{ fontWeight: "bold", fontSize: 15 }}>Model:</Text>{" "}
              {item.model}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 5,
    paddingTop: 15,
    marginTop: 40,
    backgroundColor: "#fff",
  },
  gridItem: {
    flex: 1,
    marginTop: 10,
    margin: 5,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    backgroundColor: "#f9f9f9",
  },
  gridText: {
    marginBottom: 5,
  },
  errorText: {
    color: "red",
    marginTop: 10,
  },
});
