import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  GestureResponderEvent,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Configuration, OpenAIApi } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
const GoogleapiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

const deepLLanguageCodes: { [key: string]: string } = {
  English: "EN-US",
  Spanish: "ES",
  French: "FR",
  German: "DE",
  Japanese: "JA",
};

export default function Dashboard() {
  const [formData, setFormData] = useState({
    language: "Hindi",
    message: "",
    model: "gpt-3.5-turbo",
  });
  const [error, setError] = useState("");
  const [showNotification, setShowNotification] = useState(false);
  const [translation, setTranslation] = useState<{ [model: string]: string }>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctedMessage, setCorrectedMessage] = useState("");
  const [storeTranslation, setStoreTranslation] = useState(false);
  const [selectedAPI, setSelectedAPI] = useState("OpenAI");
  const [ratingMode, setRatingMode] = useState(false);
  const [rating, setRating] = useState<{ [model: string]: number | null }>({});
  const [selectedModels, setSelectedModels] = useState<string[]>([]);

  useEffect(() => {
    {
      setCorrectedMessage("");
      setTranslation({});
      setError("");
    }
  }, [apiKey, selectedAPI, formData.model, formData.language, setTranslation]);

  const handleInputChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
    setError("");
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleAPIChange = (value: string) => {
    setSelectedAPI(value);

    if (value === "OpenAI") {
      setFormData((prev) => ({ ...prev, model: "gpt-3.5-turbo" }));
    } else {
      setFormData((prev) => ({ ...prev, model: "gemini-1.5-flash" }));
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    setStoreTranslation(checked);
  };

  const toggleCorrectionMode = () => {
    setCorrectionMode(!correctionMode);
  };

  const handleRatingCheckboxChange = (checked: boolean) => {
    setRatingMode(checked);
    if (!checked) {
      setSelectedModels([]);
    }
  };

  const handleModelCheckboxChange = (value: string, checked: boolean) => {
    setSelectedModels((prev) =>
      checked ? [...prev, value] : prev.filter((model) => model !== value)
    );
  };

  const correctText = async (message: string) => {
    setIsLoading(true);
    try {
      if (!apiKey) throw new Error("API key is missing.");

      const configuration = new Configuration({ apiKey });
      const openai = new OpenAIApi(configuration);
      const { language, model } = formData;

      const response = await openai.createChatCompletion({
        model: model,
        messages: [
          {
            role: "system",
            content: `Correct and improve the following text in ${language}. Do not add any comments, titles, or extra information. Provide only the corrected and improved version of the original message.`,
          },
          { role: "user", content: message },
        ],
        temperature: 0.3,
        max_tokens: 100,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
      });

      const correctedText =
        response.data?.choices?.[0]?.message?.content?.trim() || "";
      setCorrectedMessage(correctedText);
      setTranslation({ [formData.model]: correctedText });
    } catch (error: any) {
      console.error("Error during text correction:", error.response || error);

      if (error.response) {
        setError(error.response.data.error.message);
      } else {
        setError(
          error.message ||
            "An error occurred while correcting the text. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };
  const translate = async () => {
    setIsLoading(true);
    const { language, message, model } = formData;
    const textToTranslate = correctionMode ? correctedMessage : message;
    const prompt = `You are a translator. Translate the following text to ${language}, do not correct the grammatical errors and do not write anything else other than the provided text translated.`;

    try {
      let translations: { [model: string]: string } = {};

      const modelsToUse = ratingMode ? selectedModels : [model];

      for (const model of modelsToUse) {
        let translatedText = "";

        if (selectedAPI === "OpenAI") {
          const configuration = new Configuration({ apiKey });
          const openai = new OpenAIApi(configuration);

          const response = await openai.createChatCompletion({
            model: model,
            messages: [
              { role: "system", content: prompt },
              { role: "user", content: textToTranslate },
            ],
            temperature: 0.3,
            max_tokens: 100,
            top_p: 1.0,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
          });

          translatedText =
            response.data && response.data.choices[0].message?.content
              ? response.data.choices[0].message.content.trim()
              : "";
        } else if (selectedAPI === "Google") {
          const genAI = new GoogleGenerativeAI(GoogleapiKey as string);
          const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
          const result = await model.generateContent(
            `${prompt}, text is: ${textToTranslate}`
          );
          const response = await result.response;
          translatedText = await response.text();
        } else if (selectedAPI === "Deepl") {
          const targetLang = deepLLanguageCodes[language];
          if (!targetLang) {
            throw new Error(`Unsupported language: ${language}`);
          }

          const requestBody = { targetLang, text: textToTranslate };

          try {
            const response = await fetch(
              "http://192.168.0.199:3000/api/translate-deepl",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
              }
            );

            if (!response.ok) {
              const errorText = await response.text();
              console.error("Error response text:", errorText);
              throw new Error(
                `Failed to fetch translation from DeepL: ${errorText}`
              );
            }

            const data = await response.json();
            console.log("Translation data:", data);
            translatedText = data.translation;
          } catch (error) {
            console.error("Error during translation:", error);

            if (error instanceof TypeError) {
              alert(
                "Network error: Please ensure your server is running and reachable at http://192.168.0.199:3000."
              );
            } else if (error instanceof Error) {
              alert(`Error during translation: ${error.message}`);
            } else {
              alert("An unknown error occurred during translation.");
            }
          }
        }

        translations[model] = translatedText;

        if (ratingMode) {
          await rateTranslation(translatedText, model);
        }
      }

      setTranslation(translations);

      if (storeTranslation) {
        await saveTranslation({
          originalText: message,
          translatedText: translations,
          language,
          model,
          ratingNumber: rating[model] ?? undefined,
        });
      }
    } catch (error: any) {
      console.error("Error during translation:", error.response || error);

      if (error.response) {
        setError(error.response.data.error.message);
      } else {
        setError(
          "An error occurred while translating or saving the text. Please try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const rateTranslation = async (translatedText: string, model: string) => {
    try {
      const configuration = new Configuration({ apiKey });
      const openai = new OpenAIApi(configuration);

      const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `Rate the quality of the following translation on a scale of 1 to 10. Provide only the rating number.`,
          },
          { role: "user", content: translatedText },
        ],
        temperature: 0.3,
        max_tokens: 10,
        top_p: 1.0,
        frequency_penalty: 0.0,
        presence_penalty: 0.0,
      });

      const ratingText = response.data?.choices?.[0]?.message?.content?.trim();
      const ratingNumber = ratingText ? parseInt(ratingText, 10) : null;
      setRating((prev) => ({ ...prev, [model]: ratingNumber }));
    } catch (error: any) {
      console.error("Error during rating:", error.response || error);

      if (error.response) {
        setError(error.response.data.error.message);
      } else {
        setError(
          error.message ||
            "An error occurred while rating the translation. Please try again."
        );
      }
    }
  };

  interface TranslationData {
    originalText: string;
    translatedText: { [model: string]: string };
    language: string;
    model: string;
    ratingNumber: number | undefined;
  }

  const saveTranslation = async (data: TranslationData): Promise<any> => {
    console.log("Saving translation with data:", data);

    try {
      const response = await fetch(
        "http://192.168.0.199:3000/api/save-translation",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      );

      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error response text:", errorText);
        throw new Error(`Failed to save translation: ${errorText}`);
      }

      const result = await response.json();
      console.log("Save translation result:", result);
      return result;
    } catch (error) {
      console.error("Error saving translation:", error);

      if (error instanceof TypeError) {
        alert(
          "Network error: Please ensure your server is running and reachable at http://192.168.0.199:3000."
        );
      } else if (error instanceof Error) {
        alert(`Error saving translation: ${error.message}`);
      } else {
        alert("An unknown error occurred while saving the translation.");
      }

      throw error; // Rethrow the error if needed for further handling.
    }
  };

  const handleOnSubmit = (e: GestureResponderEvent) => {
    e.preventDefault();
    if (!formData.message) {
      setError("Please enter the message.");
      return;
    }

    if (correctionMode) {
      correctText(formData.message);
    } else {
      translate();
    }
  };

  const handleCopy = () => {
    Alert.alert("Copied to clipboard!", JSON.stringify(translation));
  };

  const clearFields = () => {
    setFormData({ language: "Hindi", message: "", model: "gpt-3.5-turbo" });
    setCorrectionMode(false);
    setCorrectedMessage("");
    setTranslation({});
    setError("");
    setRating({});
    setSelectedModels([]);
  };

  const googleModels = [
    "gemini-1.5-flash",
    "gemini-1.5-ultra",
    "gemini-1.5-pro-002",
    "gemini-1.5-flash-002",
  ];

  const openaiModels = ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"];

  const deeplModels = ["Default"];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Translation App</Text>
      <View style={styles.form}>
        <View style={styles.choices}>
          {["Hindi", "Spanish", "English", "Japanese", "French", "German"].map(
            (lang) => (
              <TouchableOpacity
                key={lang}
                style={styles.choices}
                onPress={() => handleInputChange("language", lang)}
              >
                <Text
                  style={
                    formData.language === lang
                      ? styles.selectedChoice
                      : styles.choiceText
                  }
                >
                  {lang}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        <TextInput
          style={styles.textarea}
          value={formData.message}
          onChangeText={(value) => handleInputChange("message", value)}
          placeholder="Enter the message to translate"
          multiline
        />
        <View style={styles.options}>
          <View style={styles.modelSelector}>
            <Text>Select Model:</Text>
            <View style={styles.dropdown}>
              <Picker
                selectedValue={formData.model}
                onValueChange={(value) => handleSelectChange("model", value)}
              >
                {(selectedAPI === "OpenAI"
                  ? openaiModels
                  : selectedAPI === "Google"
                  ? googleModels
                  : deeplModels
                ).map((model) => (
                  <Picker.Item key={model} label={model} value={model} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={styles.apiSelector}>
            <Text>Select API:</Text>
            <View style={styles.dropdown}>
              <Picker
                selectedValue={selectedAPI}
                onValueChange={(value) => handleAPIChange(value)}
              >
                <Picker.Item label="OpenAI" value="OpenAI" />
                <Picker.Item label="Google" value="Google" />
                <Picker.Item label="Deepl" value="Deepl" />
              </Picker>
            </View>
          </View>
          <View style={styles.options}>
            <View style={styles.correctionMode}>
              <TouchableOpacity onPress={toggleCorrectionMode}>
                <View style={styles.choices}>
                  <Text
                    style={
                      correctionMode ? styles.selectedChoice : styles.choiceText
                    }
                  >
                    Correct Message
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.ratingMode}>
              <TouchableOpacity
                onPress={() => handleRatingCheckboxChange(!ratingMode)}
              >
                <View style={styles.choices}>
                  <Text
                    style={
                      ratingMode ? styles.selectedChoice : styles.choiceText
                    }
                  >
                    Rate Translation
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.storeTranslation}>
              <TouchableOpacity
                onPress={() => handleCheckboxChange(!storeTranslation)}
              >
                <View style={styles.choices}>
                  <Text
                    style={
                      storeTranslation
                        ? styles.selectedChoice
                        : styles.choiceText
                    }
                  >
                    Store Translation
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {ratingMode && (
          <View style={styles.modelCheckbox}>
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              Select Models for Translation:
            </Text>
            {[...openaiModels, ...googleModels, ...deeplModels].map((model) => (
              <View key={model} style={styles.allmodelSelector}>
                <TouchableOpacity
                  onPress={() =>
                    handleModelCheckboxChange(
                      model,
                      !selectedModels.includes(model)
                    )
                  }
                >
                  <Text
                    style={
                      selectedModels.includes(model)
                        ? styles.selectedChoice
                        : styles.choiceText
                    }
                  >
                    {model}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.buttons}>
          <Button
            title={isLoading ? "Translating..." : "Translate"}
            onPress={handleOnSubmit}
            disabled={isLoading}
          />
          <Button title="Clear" onPress={clearFields} />
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {translation && (
        <View style={styles.translationResult}>
          <Text style={styles.translationTitle}>Translation</Text>
          {Object.entries(translation).map(([model, text]) => (
            <View key={model} style={styles.translation}>
              <Text style={styles.model}>{model}</Text>
              <TextInput
                style={styles.translationTextarea}
                value={text}
                onChangeText={(value) =>
                  handleInputChange(`translation-${model}`, value)
                }
                multiline
              />
              <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
                <Text>Copy</Text>
              </TouchableOpacity>
              {rating[model] !== null && (
                <View style={styles.rating}>
                  <Text>Rating: {rating[model]}/10</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {showNotification && (
        <Text style={styles.notification}>Copied to clipboard!</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingRight: 15,
    paddingLeft: 15,
    backgroundColor: "#fff",
    flexGrow: 1,
    marginTop: 30,
  },
  title: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  form: {
    marginBottom: 20,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    padding: 5,
    borderRadius: 5,
    backgroundColor: "#e0e0e0",
  },
  choiceText: {
    fontSize: 16,
    color: "#333",
  },
  selectedChoice: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
  },
  textarea: {
    height: 100,
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 20,
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-evenly",
  },
  modelSelector: {
    marginBottom: 10,
  },
  apiSelector: {
    marginBottom: 10,
  },
  correctionMode: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  ratingMode: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  storeTranslation: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  modelCheckbox: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    alignItems: "center",
    marginBottom: 10,
    borderRadius: 5,
    padding: 10,
    backgroundColor: "#e0e0e0",
  },
  allmodelSelector: {
    margin: 5,
    padding: 5,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  error: {
    color: "red",
    marginBottom: 20,
  },
  translationResult: {
    marginBottom: 20,
  },
  translationTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  translation: {
    marginBottom: 20,
  },
  model: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  translationTextarea: {
    height: 100,
    borderColor: "#ccc",
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  copyButton: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
  },
  rating: {
    marginTop: 10,
  },
  dropdown: {
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: "#fff",
    width: 150,
  },
  notification: {
    color: "green",
    marginTop: 20,
  },
});
